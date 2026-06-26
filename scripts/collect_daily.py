"""Daily ETF holdings and meta collection via pykrx."""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import pandas as pd
from dotenv import load_dotenv
from psycopg import OperationalError

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db_client import fetch_all, get_connection, upsert_rows
from etf_meta import build_meta
from portfolio_weight import impute_portfolio_weights, parse_eval_amount, parse_quantity, parse_weight
from stock_filter import is_trackable_stock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(ROOT, ".env.local"))
load_dotenv(os.path.join(ROOT, ".env"))

CHECKPOINT_DIR = Path(ROOT) / "scripts" / ".checkpoints"
UPSERT_CHUNK = 150
DB_RETRIES = 3
DEFAULT_WORKERS = 8


def normalize_pykrx_ticker(ticker: str) -> str:
    """etf_universe uses A-prefix (A273130); pykrx expects 273130."""
    if ticker.startswith("A") and len(ticker) > 1:
        return ticker[1:]
    return ticker


def krx_login() -> None:
    krx_id = (os.environ.get("KRX_ID") or "").strip()
    krx_pw = (os.environ.get("KRX_PW") or "").strip()
    if not krx_id or not krx_pw:
        raise RuntimeError("KRX_ID and KRX_PW are required in .env.local")

    from pykrx.website.comm.auth import build_krx_session, set_auth_session

    session = build_krx_session(krx_id, krx_pw)
    if session is None:
        raise RuntimeError(
            "KRX login failed. Verify KRX_ID/KRX_PW at https://data.krx.co.kr "
            "(data marketplace account, not regular stock account)."
        )
    set_auth_session(session)
    print("KRX login OK")


def yyyymmdd(d: date) -> str:
    return d.strftime("%Y%m%d")


def checkpoint_path(as_of: date) -> Path:
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    return CHECKPOINT_DIR / f"collect_daily_{as_of.isoformat()}.json"


def load_checkpoint(as_of: date) -> dict[str, list[Any]]:
    path = checkpoint_path(as_of)
    if not path.exists():
        return {"ok": [], "failed": [], "skipped": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"ok": [], "failed": [], "skipped": []}
    return {
        "ok": list(data.get("ok", [])),
        "failed": list(data.get("failed", [])),
        "skipped": list(data.get("skipped", [])),
    }


def save_checkpoint(as_of: date, results: dict[str, list[Any]]) -> None:
    checkpoint_path(as_of).write_text(
        json.dumps(results, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def get_saved_tickers(as_of: date) -> set[str]:
    with get_connection() as conn:
        rows = fetch_all(
            conn,
            """
            SELECT etf_ticker
            FROM holdings_daily
            WHERE date = %s
            GROUP BY etf_ticker
            HAVING COUNT(*) > 0
            """,
            [as_of.isoformat()],
        )
    return {str(row["etf_ticker"]) for row in rows}


def get_target_etfs(conn, tickers: list[str] | None, limit: int | None) -> list[dict[str, Any]]:
    if tickers:
        rows = fetch_all(
            conn,
            """
            SELECT ticker, name FROM etf_universe
            WHERE crawl_enabled = true AND ticker = ANY(%s)
            ORDER BY ticker
            """,
            [tickers],
        )
    else:
        rows = fetch_all(
            conn,
            """
            SELECT u.ticker, u.name
            FROM etf_universe u
            LEFT JOIN LATERAL (
              SELECT aum FROM etf_meta_daily
              WHERE etf_ticker = u.ticker
              ORDER BY date DESC LIMIT 1
            ) m ON TRUE
            WHERE u.crawl_enabled = true AND u.is_listed = true
            ORDER BY m.aum DESC NULLS LAST, u.ticker
            """,
        )
    return rows[:limit] if limit else rows


def fetch_holdings(ticker: str, as_of: date) -> tuple[list[dict[str, Any]], pd.DataFrame | None, date | None]:
    from pykrx import stock

    pykrx_ticker = normalize_pykrx_ticker(ticker)
    rows: list[dict[str, Any]] = []
    portfolio_df: pd.DataFrame | None = None
    snapshot_date: date | None = None
    for offset in range(0, 7):
        target = as_of - timedelta(days=offset)
        try:
            df = stock.get_etf_portfolio_deposit_file(pykrx_ticker, yyyymmdd(target))
        except Exception:
            continue
        if df is None or df.empty:
            continue

        portfolio_df = df
        snapshot_date = target
        for idx, row in df.iterrows():
            raw = idx if idx is not None and str(idx).strip() else row.get("티커", row.get("종목코드", ""))
            code = str(raw).strip()
            code = "".join(ch for ch in code if ch.isdigit()).zfill(6)[-6:]
            if not code:
                continue
            parsed_weight = parse_weight(row)
            weight = parsed_weight if parsed_weight is not None else (
                float(row.get("비중", row.get("계약수량비중")))
                if pd.notna(row.get("비중", row.get("계약수량비중")))
                else None
            )
            qty = parse_quantity(row)
            if qty is None:
                raw_qty = row.get("계약수", row.get("계약수량", row.get("수량")))
                qty = float(raw_qty) if pd.notna(raw_qty) else None
            name = row.get("구성종목명", row.get("종목명"))
            stock_name = str(name) if pd.notna(name) else None
            if not is_trackable_stock(code, stock_name):
                continue
            rows.append(
                {
                    "stock_code": code,
                    "stock_name": stock_name,
                    "weight": weight if weight and weight > 0 else None,
                    "quantity": qty,
                    "_eval_amount": parse_eval_amount(row),
                }
            )
        if rows:
            impute_portfolio_weights(rows, target)
            for item in rows:
                item.pop("_eval_amount", None)
            return rows, portfolio_df, snapshot_date
    return rows, portfolio_df, snapshot_date


def load_meta_baseline(conn, ticker: str, before: date) -> tuple[float | None, float | None]:
    rows = fetch_all(
        conn,
        """
        SELECT aum, nav
        FROM etf_meta_daily
        WHERE etf_ticker = %s
          AND aum IS NOT NULL AND aum > 0
          AND nav IS NOT NULL AND nav > 0
          AND date < %s
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


def fetch_meta(
    ticker: str,
    as_of: date,
    *,
    portfolio_df: pd.DataFrame | None = None,
    holdings: list[dict[str, Any]] | None = None,
    baseline_aum: float | None = None,
    baseline_nav: float | None = None,
) -> dict[str, Any]:
    return build_meta(
        ticker,
        as_of,
        portfolio_df=portfolio_df,
        holdings=holdings,
        baseline_aum=baseline_aum,
        baseline_nav=baseline_nav,
        holdings_price_lookup=True,
    )


def upsert_holdings(conn, as_of: date, ticker: str, holdings: list[dict[str, Any]]) -> int:
    if not holdings:
        return 0
    payload = [
        {
            "date": as_of.isoformat(),
            "etf_ticker": ticker,
            **row,
        }
        for row in holdings
    ]
    total = 0
    for start in range(0, len(payload), UPSERT_CHUNK):
        chunk = payload[start : start + UPSERT_CHUNK]
        total += upsert_rows(
            conn,
            "holdings_daily",
            chunk,
            conflict_columns=["date", "etf_ticker", "stock_code"],
            update_columns=["stock_name", "weight", "quantity"],
        )
    return total


def upsert_meta(conn, as_of: date, ticker: str, meta: dict[str, Any]) -> None:
    upsert_rows(
        conn,
        "etf_meta_daily",
        [{"date": as_of.isoformat(), "etf_ticker": ticker, **meta}],
        conflict_columns=["date", "etf_ticker"],
        update_columns=["aum", "nav", "listed_shares"],
    )


def persist_etf(as_of: date, ticker: str, holdings: list[dict[str, Any]], meta: dict[str, Any]) -> int:
    """Write one ETF on a fresh DB connection, with retries."""
    last_error: Exception | None = None
    for attempt in range(DB_RETRIES):
        try:
            with get_connection() as conn:
                count = upsert_holdings(conn, as_of, ticker, holdings)
                upsert_meta(conn, as_of, ticker, meta)
                return count
        except OperationalError as exc:
            last_error = exc
            if attempt < DB_RETRIES - 1:
                wait = 1.5 * (attempt + 1)
                print(f"  DB retry {attempt + 1}/{DB_RETRIES} for {ticker} in {wait:.1f}s")
                time.sleep(wait)
    assert last_error is not None
    raise last_error


def process_one(ticker: str, as_of: date) -> dict[str, Any]:
    """Fetch + persist a single ETF. Network/DB only — no shared state."""
    try:
        holdings, portfolio_df, snap_date = fetch_holdings(ticker, as_of)
        if not holdings:
            return {"ticker": ticker, "status": "skip"}

        meta_date = snap_date or as_of
        with get_connection() as conn:
            baseline_aum, baseline_nav = load_meta_baseline(conn, ticker, meta_date)
        meta = fetch_meta(
            ticker,
            meta_date,
            portfolio_df=portfolio_df,
            holdings=holdings,
            baseline_aum=baseline_aum,
            baseline_nav=baseline_nav,
        )
        count = persist_etf(as_of, ticker, holdings, meta)
        return {"ticker": ticker, "status": "ok", "count": count}
    except Exception as exc:  # noqa: BLE001
        return {"ticker": ticker, "status": "fail", "error": str(exc)}


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect ETF holdings via pykrx")
    parser.add_argument("--date", type=str, default=date.today().isoformat())
    parser.add_argument("--ticker", action="append", dest="tickers")
    parser.add_argument("--limit", type=int, default=None, help="Max ETFs to collect")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-fetch ETFs already saved for this date (default: skip saved)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=DEFAULT_WORKERS,
        help=f"Concurrent fetch threads (default {DEFAULT_WORKERS}, 1=sequential)",
    )
    args = parser.parse_args()

    as_of = date.fromisoformat(args.date)
    krx_login()

    results = load_checkpoint(as_of)
    saved_tickers = set() if args.force else get_saved_tickers(as_of)

    with get_connection() as conn:
        etfs = get_target_etfs(conn, args.tickers, args.limit)

    pending = [e for e in etfs if args.force or e["ticker"] not in saved_tickers]
    skipped_resume = len(etfs) - len(pending)
    if skipped_resume:
        print(f"Resume: {skipped_resume} ETFs already in DB for {as_of}, skipping those")

    workers = max(1, args.workers)
    total = len(pending)
    print(f"Collecting {total} ETFs on {as_of} with {workers} worker(s)")

    ok_count = len(results["ok"])
    done = 0
    lock = threading.Lock()

    def record(res: dict[str, Any]) -> None:
        nonlocal ok_count, done
        ticker = res["ticker"]
        status = res["status"]
        done += 1
        if status == "ok":
            results["failed"] = [f for f in results["failed"] if f.get("ticker") != ticker]
            results["ok"] = [o for o in results["ok"] if o.get("ticker") != ticker]
            results["ok"].append({"ticker": ticker, "holdings": res["count"]})
            ok_count += 1
            print(f"OK {ticker}: {res['count']} holdings saved ({done}/{total}, total {ok_count})")
        elif status == "skip":
            results["skipped"] = [s for s in results["skipped"] if s != ticker]
            results["skipped"].append(ticker)
            print(f"SKIP {ticker}: no holdings ({done}/{total})")
        else:
            results["failed"] = [f for f in results["failed"] if f.get("ticker") != ticker]
            results["failed"].append({"ticker": ticker, "error": res["error"]})
            print(f"FAIL {ticker}: {res['error']} ({done}/{total})")
        if done % 10 == 0 or done == total:
            save_checkpoint(as_of, results)

    if workers == 1:
        for etf in pending:
            record(process_one(etf["ticker"], as_of))
    else:
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(process_one, etf["ticker"], as_of): etf["ticker"]
                for etf in pending
            }
            for future in as_completed(futures):
                res = future.result()
                with lock:
                    record(res)

    save_checkpoint(as_of, results)
    print(f"Checkpoint: {checkpoint_path(as_of)}")
    if results["failed"] and not results["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
