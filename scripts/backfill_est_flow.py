"""Backfill / repair holdings_diff.est_flow_krw using per-ETF AUM."""

from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from compute_holdings_diff import load_meta
from db_client import fetch_all, get_connection, upsert_rows
from est_flow import is_implausible_stored_flow, resolve_est_flow_krw

UPSERT_CHUNK = 500


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill holdings_diff.est_flow_krw")
    parser.add_argument(
        "--recalculate",
        action="store_true",
        help="Recompute all rows with weight_delta (fixes median-AUM overestimates)",
    )
    args = parser.parse_args()

    with get_connection() as conn:
        if args.recalculate:
            rows = fetch_all(
                conn,
                """
                SELECT date::text AS date, etf_ticker, stock_code, stock_name,
                       change_type, weight_delta, est_flow_krw
                FROM holdings_diff
                WHERE weight_delta IS NOT NULL AND weight_delta <> 0
                ORDER BY date DESC
                """,
            )
        else:
            rows = fetch_all(
                conn,
                """
                SELECT date::text AS date, etf_ticker, stock_code, stock_name,
                       change_type, weight_delta, est_flow_krw
                FROM holdings_diff
                WHERE weight_delta IS NOT NULL
                  AND weight_delta <> 0
                  AND (est_flow_krw IS NULL OR est_flow_krw = 0)
                ORDER BY date DESC
                """,
            )

        print(f"Rows to process: {len(rows)} (recalculate={args.recalculate})")

        aum_cache: dict[tuple[str, str], float | None] = {}
        payload: list[dict] = []
        updated = 0
        skipped = 0

        for row in rows:
            row_date = str(row["date"])
            ticker = str(row["etf_ticker"])
            delta = float(row["weight_delta"])
            stored = float(row["est_flow_krw"]) if row.get("est_flow_krw") is not None else None

            cache_key = (row_date, ticker)
            if cache_key not in aum_cache:
                aum_cache[cache_key] = load_meta(conn, date.fromisoformat(row_date), ticker)

            aum = aum_cache[cache_key]
            if not args.recalculate and stored not in (None, 0):
                skipped += 1
                continue
            if args.recalculate and not is_implausible_stored_flow(stored, delta, aum) and stored not in (
                None,
                0,
            ):
                skipped += 1
                continue

            est_flow = resolve_est_flow_krw(delta, aum, stored, median_aum=None)
            if est_flow is None:
                skipped += 1
                continue
            if args.recalculate and stored is not None and abs(est_flow - stored) < 1:
                skipped += 1
                continue

            payload.append(
                {
                    "date": row_date,
                    "etf_ticker": ticker,
                    "stock_code": row["stock_code"],
                    "stock_name": row.get("stock_name"),
                    "change_type": row["change_type"],
                    "weight_delta": delta,
                    "est_flow_krw": est_flow,
                }
            )
            updated += 1

            if len(payload) >= UPSERT_CHUNK:
                upsert_rows(
                    conn,
                    "holdings_diff",
                    payload,
                    conflict_columns=["date", "etf_ticker", "stock_code", "change_type"],
                    update_columns=["est_flow_krw"],
                )
                payload.clear()

        if payload:
            upsert_rows(
                conn,
                "holdings_diff",
                payload,
                conflict_columns=["date", "etf_ticker", "stock_code", "change_type"],
                update_columns=["est_flow_krw"],
            )

        print(f"Updated est_flow_krw for {updated} rows (skipped {skipped})")


if __name__ == "__main__":
    main()
