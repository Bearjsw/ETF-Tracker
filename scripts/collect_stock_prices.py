"""Collect Korean and overseas stock closing prices into prices_daily."""

from __future__ import annotations

import argparse
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db_client import fetch_all, get_connection, upsert_rows
from overseas_ticker_resolve import export_code_map_from_db, resolve_overseas_ticker

UPSERT_EVERY_STOCKS = 50


def is_korean_stock_code(code: str) -> bool:
    return len(code) == 6 and code.isdigit()


def get_holdings_stock_codes(limit: int | None) -> list[str]:
    with get_connection() as conn:
        rows = fetch_all(
            conn,
            """
            SELECT DISTINCT stock_code FROM (
              SELECT stock_code FROM holdings_daily
              UNION
              SELECT stock_code FROM holdings_diff
              UNION
              SELECT stock_code FROM signals_daily
            ) s
            WHERE stock_code ~ '^[0-9]{6}$'
            ORDER BY stock_code
            """,
        )
    codes = [str(r["stock_code"]) for r in rows if is_korean_stock_code(str(r["stock_code"]))]
    return codes[:limit] if limit else codes


def get_all_listed_codes() -> list[str]:
    import FinanceDataReader as fdr

    codes: set[str] = set()
    for market in ("KOSPI", "KOSDAQ"):
        try:
            df = fdr.StockListing(market)
        except Exception as exc:
            print(f"WARN {market} listing failed: {exc}")
            continue
        if df is None or df.empty:
            continue
        code_col = "Code" if "Code" in df.columns else "Symbol" if "Symbol" in df.columns else df.columns[0]
        for raw in df[code_col].astype(str):
            digits = "".join(ch for ch in raw if ch.isdigit()).zfill(6)[-6:]
            if is_korean_stock_code(digits):
                codes.add(digits)
    return sorted(codes)


def fetch_close_series(stock_code: str, start: date, end: date, market_symbol: str | None = None) -> list[dict[str, Any]]:
    import FinanceDataReader as fdr

    symbol = market_symbol or stock_code
    try:
        df = fdr.DataReader(symbol, start.isoformat(), end.isoformat())
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
        rows.append({"date": day.isoformat(), "stock_code": stock_code, "close": float(value)})
    return rows


def get_overseas_holdings() -> list[tuple[str, str, str]]:
    """Return (krx_code, stock_name, us_ticker) for overseas holdings."""
    with get_connection() as conn:
        rows = fetch_all(
            conn,
            """
            SELECT DISTINCT stock_code, stock_name
            FROM holdings_daily
            WHERE stock_name ~ '[A-Z]{3,}'
              AND stock_code ~ '^[0-9]{6}$'
              AND stock_code <> '000000'
            ORDER BY stock_code
            """,
        )
    result: list[tuple[str, str, str]] = []
    seen: set[str] = set()
    for row in rows:
        code = str(row["stock_code"])
        name = str(row.get("stock_name") or "")
        if code in seen:
            continue
        ticker = resolve_overseas_ticker(code, name)
        if ticker:
            seen.add(code)
            result.append((code, name, ticker))
    return result


def flush_price_rows(rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    with get_connection() as conn:
        return upsert_rows(
            conn,
            "prices_daily",
            rows,
            conflict_columns=["date", "stock_code"],
            update_columns=["close"],
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect stock closing prices")
    parser.add_argument("--days", type=int, default=365)
    parser.add_argument("--limit", type=int, default=None, help="Max stock codes to fetch")
    parser.add_argument(
        "--all-listed",
        action="store_true",
        help="Fetch all KOSPI/KOSDAQ listed codes (via FinanceDataReader), merged with holdings codes",
    )
    parser.add_argument(
        "--include-overseas",
        action="store_true",
        help="Also fetch overseas holdings via US ticker (stored under KRX stock_code)",
    )
    args = parser.parse_args()

    end = date.today()
    start = end - timedelta(days=args.days)

    codes = set(get_holdings_stock_codes(None))
    if args.all_listed:
        listed = get_all_listed_codes()
        print(f"Listed market codes: {len(listed)}")
        codes.update(listed)

    ordered = sorted(codes)
    if args.limit:
        ordered = ordered[: args.limit]

    if not ordered:
        print("No Korean stock codes found.")
        return

    pending: list[dict[str, Any]] = []
    failed: list[str] = []
    ok_stocks = 0
    upserted = 0

    for i, code in enumerate(ordered, start=1):
        series = fetch_close_series(code, start, end)
        if series:
            pending.extend(series)
            ok_stocks += 1
            if i % 50 == 0 or i == len(ordered):
                print(f"OK {code}: {len(series)} days ({i}/{len(ordered)})")
        else:
            failed.append(code)

        if ok_stocks > 0 and ok_stocks % UPSERT_EVERY_STOCKS == 0:
            upserted += flush_price_rows(pending)
            pending = []
            print(f"  → flushed {upserted} rows to DB")

    upserted += flush_price_rows(pending)
    print(
        f"Upserted {upserted} price rows for {ok_stocks} stocks "
        f"({start} → {end}, requested {len(ordered)})"
    )
    if failed:
        print(f"Failed/empty: {len(failed)} codes")

    if args.include_overseas:
        with get_connection() as conn:
            code_map = export_code_map_from_db(conn)
        overseas = get_overseas_holdings()
        if not overseas and code_map:
            overseas = [(c, "", t) for c, t in sorted(code_map.items())]

        print(f"Overseas holdings to fetch: {len(overseas)}")
        pending = []
        ok_overseas = 0
        failed_overseas: list[str] = []

        for i, (krx_code, _name, ticker) in enumerate(overseas, start=1):
            series = fetch_close_series(krx_code, start, end, market_symbol=ticker)
            if series:
                pending.extend(series)
                ok_overseas += 1
                if i % 20 == 0 or i == len(overseas):
                    print(f"OK overseas {krx_code} ({ticker}): {len(series)} days ({i}/{len(overseas)})")
            else:
                failed_overseas.append(f"{krx_code}:{ticker}")

            if ok_overseas > 0 and ok_overseas % 20 == 0:
                upserted += flush_price_rows(pending)
                pending = []

        upserted += flush_price_rows(pending)
        print(f"Overseas: upserted for {ok_overseas} stocks, failed {len(failed_overseas)}")


if __name__ == "__main__":
    main()
