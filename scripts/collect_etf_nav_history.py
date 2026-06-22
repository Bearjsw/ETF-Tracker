"""Collect real ETF NAV/close history into etf_meta_daily via FinanceDataReader."""

from __future__ import annotations

import argparse
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db_client import fetch_all, get_connection, upsert_rows


def normalize_fdr_ticker(ticker: str) -> str:
    """etf_universe uses leading A prefix (e.g. A273130); FDR expects 273130."""
    if ticker.startswith("A") and len(ticker) > 1:
        return ticker[1:]
    return ticker


def get_etf_tickers(conn, limit: int | None) -> list[str]:
    rows = fetch_all(
        conn,
        """
        SELECT DISTINCT etf_ticker AS ticker FROM (
          SELECT etf_ticker FROM holdings_daily
          UNION
          SELECT etf_ticker FROM holdings_diff
          UNION
          SELECT unnest(etf_tickers) AS etf_ticker FROM signals_daily
        ) t
        WHERE etf_ticker IS NOT NULL AND etf_ticker <> ''
        ORDER BY etf_ticker
        """,
    )
    tickers = [str(r["ticker"]) for r in rows]
    if tickers:
        return tickers[:limit] if limit else tickers

    rows = fetch_all(
        conn,
        """
        SELECT u.ticker
        FROM etf_universe u
        LEFT JOIN LATERAL (
          SELECT aum FROM etf_meta_daily
          WHERE etf_ticker = u.ticker
          ORDER BY date DESC LIMIT 1
        ) m ON TRUE
        WHERE u.crawl_enabled = TRUE AND u.is_listed = TRUE
        ORDER BY m.aum DESC NULLS LAST, u.ticker
        """,
    )
    tickers = [str(r["ticker"]) for r in rows]
    return tickers[:limit] if limit else tickers


def purge_ticker_nav(conn, ticker: str) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM etf_meta_daily WHERE etf_ticker = %s", [ticker])
    conn.commit()


def fetch_nav_rows(ticker: str, start: date, end: date) -> list[dict[str, Any]]:
    import FinanceDataReader as fdr

    fdr_symbol = normalize_fdr_ticker(ticker)
    try:
        df = fdr.DataReader(fdr_symbol, start.isoformat(), end.isoformat())
    except Exception:
        return []

    if df is None or df.empty:
        return []

    close_col = "Close" if "Close" in df.columns else df.columns[-1]
    rows: list[dict[str, Any]] = []

    for idx, value in df[close_col].items():
        if pd.isna(value):
            continue
        day = idx.date() if hasattr(idx, "date") else date.fromisoformat(str(idx)[:10])
        rows.append(
            {
                "date": day.isoformat(),
                "etf_ticker": ticker,
                "nav": round(float(value), 4),
                "aum": None,
                "listed_shares": None,
            }
        )
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect ETF NAV history")
    parser.add_argument("--days", type=int, default=365)
    parser.add_argument("--limit", type=int, default=80, help="Max ETFs to fetch")
    parser.add_argument("--all-crawl", action="store_true", help="Fetch top crawl-enabled ETFs (not only holdings)")
    args = parser.parse_args()

    end = date.today()
    start = end - timedelta(days=args.days)

    with get_connection() as conn:
        if args.all_crawl:
            rows = fetch_all(
                conn,
                """
                SELECT u.ticker
                FROM etf_universe u
                LEFT JOIN LATERAL (
                  SELECT aum FROM etf_meta_daily
                  WHERE etf_ticker = u.ticker
                  ORDER BY date DESC LIMIT 1
                ) m ON TRUE
                WHERE u.crawl_enabled = TRUE AND u.is_listed = TRUE
                ORDER BY m.aum DESC NULLS LAST, u.ticker
                LIMIT %s
                """,
                [args.limit],
            )
            tickers = [str(r["ticker"]) for r in rows]
        else:
            tickers = get_etf_tickers(conn, args.limit)
        if not tickers:
            print("No ETF tickers found.")
            return

        all_rows: list[dict[str, Any]] = []
        failed: list[str] = []

        for ticker in tickers:
            series = fetch_nav_rows(ticker, start, end)
            if series:
                purge_ticker_nav(conn, ticker)
                all_rows.extend(series)
                print(f"OK {ticker}: {len(series)} days (replaced)")
            else:
                failed.append(ticker)
                print(f"SKIP {ticker}: no data")

        count = upsert_rows(
            conn,
            "etf_meta_daily",
            all_rows,
            conflict_columns=["date", "etf_ticker"],
            update_columns=["nav", "aum", "listed_shares"],
        )
        print(f"Upserted {count} NAV rows for {len(tickers) - len(failed)} ETFs ({start} → {end})")
        if failed:
            print(f"Failed/empty: {', '.join(failed[:20])}{'...' if len(failed) > 20 else ''}")


if __name__ == "__main__":
    main()
