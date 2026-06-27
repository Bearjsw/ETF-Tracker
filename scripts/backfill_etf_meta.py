"""Backfill etf_meta_daily.aum when pykrx OHLCV has no AUM column."""

from __future__ import annotations

import argparse
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, timedelta
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db_client import fetch_all, get_connection, upsert_rows
from etf_meta import (
    build_meta,
    compute_aum_from_portfolio_df,
    normalize_pykrx_ticker,
    yyyymmdd,
)


def krx_login() -> None:
    from collect_daily import krx_login as _login

    _login()


def load_baseline(conn, ticker: str, before: date) -> tuple[float | None, float | None]:
    rows = fetch_all(
        conn,
        """
        SELECT aum, nav
        FROM etf_meta_daily
        WHERE etf_ticker = %s
          AND aum IS NOT NULL AND aum > 0
          AND nav IS NOT NULL AND nav > 0
          AND date <= %s
        ORDER BY date DESC
        LIMIT 1
        """,
        [ticker, before.isoformat()],
    )
    if not rows:
        return None, None
    row = rows[0]
    return (
        float(row["aum"]) if row.get("aum") is not None else None,
        float(row["nav"]) if row.get("nav") is not None else None,
    )


def load_holdings_from_db(conn, ticker: str, as_of: date) -> list[dict[str, Any]]:
    rows = fetch_all(
        conn,
        """
        SELECT stock_code, stock_name, weight, quantity
        FROM holdings_daily
        WHERE etf_ticker = %s AND date = %s
        """,
        [ticker, as_of.isoformat()],
    )
    return [
        {
            "stock_code": row["stock_code"],
            "stock_name": row.get("stock_name"),
            "weight": float(row["weight"]) if row.get("weight") is not None else None,
            "quantity": float(row["quantity"]) if row.get("quantity") is not None else None,
        }
        for row in rows
    ]


def fetch_portfolio_df(ticker: str, as_of: date):
    from pykrx import stock

    pykrx_ticker = normalize_pykrx_ticker(ticker)
    for offset in range(7):
        target = as_of - timedelta(days=offset)
        try:
            df = stock.get_etf_portfolio_deposit_file(pykrx_ticker, yyyymmdd(target))
        except Exception:
            continue
        if df is not None and not df.empty:
            return df
    return None


def load_targets(conn, as_of: date | None, ticker: str | None) -> list[dict[str, Any]]:
    clauses = ["1=1"]
    params: list[Any] = []
    if as_of:
        clauses.append("h.date = %s")
        params.append(as_of.isoformat())
    if ticker:
        clauses.append("h.etf_ticker = %s")
        params.append(ticker)

    return fetch_all(
        conn,
        f"""
        SELECT h.date::text AS date, h.etf_ticker AS ticker
        FROM holdings_daily h
        LEFT JOIN etf_meta_daily m
          ON m.date = h.date AND m.etf_ticker = h.etf_ticker
        WHERE {' AND '.join(clauses)}
          AND (m.aum IS NULL OR m.aum = 0 OR m.etf_ticker IS NULL)
        GROUP BY h.date, h.etf_ticker
        ORDER BY h.date, h.etf_ticker
        """,
        params,
    )


def process_target(target: dict[str, Any], refetch_portfolio: bool, fast: bool) -> dict[str, Any] | None:
    """Compute meta for one ETF-day. Uses its own DB connection (thread-safe)."""
    snap_date = date.fromisoformat(str(target["date"]))
    etf_ticker = str(target["ticker"])

    with get_connection() as conn:
        baseline_aum, baseline_nav = load_baseline(conn, etf_ticker, snap_date)
        holdings = load_holdings_from_db(conn, etf_ticker, snap_date)

    portfolio_df = fetch_portfolio_df(etf_ticker, snap_date) if refetch_portfolio else None

    meta = build_meta(
        etf_ticker,
        snap_date,
        portfolio_df=portfolio_df,
        holdings=holdings,
        baseline_aum=baseline_aum,
        baseline_nav=baseline_nav,
        holdings_price_lookup=not fast,
    )

    if meta.get("aum") is None and meta.get("nav") is None:
        return None

    return {"date": snap_date.isoformat(), "etf_ticker": etf_ticker, **meta}


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill ETF AUM in etf_meta_daily")
    parser.add_argument("--date", type=str, default=None, help="Single date YYYY-MM-DD")
    parser.add_argument("--ticker", type=str, default=None, help="Single ETF ticker")
    parser.add_argument("--fast", action="store_true", help="Skip slow price lookups for holdings sum")
    parser.add_argument("--workers", type=int, default=8, help="Parallel workers (default: 8)")
    parser.add_argument(
        "--refetch-portfolio",
        action="store_true",
        help="Re-fetch KRX portfolio file (default: use DB holdings only)",
    )
    args = parser.parse_args()

    krx_login()
    as_of = date.fromisoformat(args.date) if args.date else None

    with get_connection() as conn:
        targets = load_targets(conn, as_of, args.ticker)

    print(
        f"Backfilling AUM for {len(targets)} ETF-day rows "
        f"(fast={args.fast}, workers={args.workers})",
        flush=True,
    )
    updated = 0
    batch: list[dict[str, Any]] = []

    def flush_batch() -> None:
        nonlocal updated, batch
        if not batch:
            return
        with get_connection() as conn:
            upsert_rows(
                conn,
                "etf_meta_daily",
                batch,
                conflict_columns=["date", "etf_ticker"],
                update_columns=["aum", "nav", "listed_shares"],
            )
        updated += len(batch)
        batch = []

    workers = max(1, args.workers)
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {
            ex.submit(process_target, t, args.refetch_portfolio, args.fast): t
            for t in targets
        }
        for i, fut in enumerate(as_completed(futures), start=1):
            try:
                row = fut.result()
            except Exception as exc:  # noqa: BLE001
                print(f"  ! error: {exc}", flush=True)
                row = None
            if row:
                batch.append(row)
            if len(batch) >= 50:
                flush_batch()
            if i % 25 == 0 or i == len(targets):
                print(f"  {i}/{len(targets)} processed, {updated + len(batch)} updated", flush=True)

    flush_batch()
    print(f"Done: {updated} rows upserted", flush=True)


if __name__ == "__main__":
    main()
