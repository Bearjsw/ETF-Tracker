"""Backfill holdings_daily.weight when KRX stored 0 for overseas / active ETF rows."""

from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db_client import fetch_all, get_connection, upsert_rows
from portfolio_weight import impute_portfolio_weights

UPSERT_CHUNK = 150


def load_snapshots(
    conn,
    *,
    as_of: date | None,
    ticker: str | None,
    only_zero: bool,
) -> list[dict[str, Any]]:
    clauses = ["1=1"]
    params: list[Any] = []

    if as_of:
        clauses.append("date = %s")
        params.append(as_of.isoformat())
    if ticker:
        clauses.append("etf_ticker = %s")
        params.append(ticker)

    where = " AND ".join(clauses)
    rows = fetch_all(
        conn,
        f"""
        SELECT date::text AS date, etf_ticker, stock_code, stock_name, weight, quantity
        FROM holdings_daily
        WHERE {where}
        ORDER BY date DESC, etf_ticker, stock_code
        """,
        params,
    )

    grouped: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for row in rows:
        key = (str(row["date"]), str(row["etf_ticker"]))
        weight = row.get("weight")
        grouped.setdefault(key, []).append(
            {
                "date": row["date"],
                "etf_ticker": row["etf_ticker"],
                "stock_code": row["stock_code"],
                "stock_name": row.get("stock_name"),
                "weight": float(weight) if weight is not None else None,
                "quantity": float(row["quantity"]) if row.get("quantity") is not None else None,
            }
        )

    snapshots: list[dict[str, Any]] = []
    for (snap_date, etf_ticker), holdings in grouped.items():
        if not holdings:
            continue
        has_missing = any((h.get("weight") or 0) <= 0 for h in holdings)
        if only_zero and not has_missing:
            continue
        snapshots.append({"date": snap_date, "etf_ticker": etf_ticker, "holdings": holdings})
    return snapshots


def persist_weights(conn, rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    total = 0
    for start in range(0, len(rows), UPSERT_CHUNK):
        chunk = rows[start : start + UPSERT_CHUNK]
        total += upsert_rows(
            conn,
            "holdings_daily",
            chunk,
            conflict_columns=["date", "etf_ticker", "stock_code"],
            update_columns=["weight"],
        )
    return total


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill ETF holding weights from qty × price")
    parser.add_argument("--date", type=str, default=None, help="Single snapshot date (YYYY-MM-DD)")
    parser.add_argument("--ticker", type=str, default=None, help="Single ETF ticker")
    parser.add_argument("--limit", type=int, default=None, help="Max ETF snapshots to process")
    parser.add_argument(
        "--all-missing",
        action="store_true",
        help="Also recompute snapshots where most weights are already set",
    )
    parser.add_argument(
        "--fast",
        action="store_true",
        help="Skip slow price lookups; use qty-only for missing weights",
    )
    args = parser.parse_args()

    as_of = date.fromisoformat(args.date) if args.date else None
    only_zero = not args.all_missing

    with get_connection() as conn:
        snapshots = load_snapshots(conn, as_of=as_of, ticker=args.ticker, only_zero=only_zero)
        if args.limit:
            snapshots = snapshots[: args.limit]

        print(f"Processing {len(snapshots)} ETF snapshots (only_zero={only_zero})")
        updated_rows = 0
        changed_snapshots = 0

        for i, snap in enumerate(snapshots, start=1):
            holdings = [dict(row) for row in snap["holdings"]]
            before = [h.get("weight") for h in holdings]
            impute_portfolio_weights(holdings, date.fromisoformat(snap["date"]), price_lookup=not args.fast)
            after = [h.get("weight") for h in holdings]
            if before == after:
                continue

            payload = [
                {
                    "date": snap["date"],
                    "etf_ticker": snap["etf_ticker"],
                    "stock_code": row["stock_code"],
                    "stock_name": row.get("stock_name"),
                    "quantity": row.get("quantity"),
                    "weight": row.get("weight"),
                }
                for row in holdings
            ]
            updated_rows += persist_weights(conn, payload)
            changed_snapshots += 1
            if i % 10 == 0 or i == len(snapshots):
                print(f"  {i}/{len(snapshots)} snapshots, {changed_snapshots} updated")

        print(f"Done: {changed_snapshots} snapshots, {updated_rows} rows upserted")


if __name__ == "__main__":
    main()
