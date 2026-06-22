"""Backfill holdings_diff.est_flow_krw when AUM was missing at diff time."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from compute_holdings_diff import load_median_aum, load_meta
from db_client import fetch_all, get_connection, upsert_rows

UPSERT_CHUNK = 500


def main() -> None:
    with get_connection() as conn:
        median_aum = load_median_aum(conn)
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
        print(f"Rows to backfill: {len(rows)} (median AUM fallback: {median_aum:,.0f})")

        aum_cache: dict[tuple[str, str], float] = {}
        payload: list[dict] = []
        updated = 0

        for row in rows:
            date = str(row["date"])
            ticker = str(row["etf_ticker"])
            delta = float(row["weight_delta"])
            cache_key = (date, ticker)
            if cache_key not in aum_cache:
                aum = load_meta(conn, __import__("datetime").date.fromisoformat(date), ticker)
                aum_cache[cache_key] = float(aum) if aum else median_aum
            est_flow = aum_cache[cache_key] * (delta / 100.0)
            payload.append(
                {
                    "date": date,
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

        print(f"Backfilled est_flow_krw for {updated} rows")


if __name__ == "__main__":
    main()
