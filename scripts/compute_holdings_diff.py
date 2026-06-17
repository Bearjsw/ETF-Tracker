"""Compute day-over-day holdings changes."""

from __future__ import annotations

import argparse
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db_client import fetch_all, get_connection, upsert_rows

WEIGHT_THRESHOLD = 0.05


def load_holdings(conn, as_of: date, tickers: list[str] | None = None) -> list[dict[str, Any]]:
    if tickers:
        return fetch_all(
            conn,
            "SELECT * FROM holdings_daily WHERE date = %s AND etf_ticker = ANY(%s)",
            [as_of.isoformat(), tickers],
        )
    return fetch_all(conn, "SELECT * FROM holdings_daily WHERE date = %s", [as_of.isoformat()])


def load_meta(conn, as_of: date, ticker: str) -> float | None:
    rows = fetch_all(
        conn,
        "SELECT aum FROM etf_meta_daily WHERE date = %s AND etf_ticker = %s LIMIT 1",
        [as_of.isoformat(), ticker],
    )
    if rows:
        return rows[0].get("aum")
    return None


def index_holdings(rows: list[dict[str, Any]]) -> dict[tuple[str, str], dict[str, Any]]:
    return {(row["etf_ticker"], row["stock_code"]): row for row in rows}


def compute_diff(
    prev_rows: list[dict[str, Any]],
    curr_rows: list[dict[str, Any]],
    as_of: date,
    aum_by_ticker: dict[str, float | None],
) -> list[dict[str, Any]]:
    prev = index_holdings(prev_rows)
    curr = index_holdings(curr_rows)
    diffs: list[dict[str, Any]] = []

    keys = set(prev.keys()) | set(curr.keys())
    for etf_ticker, stock_code in keys:
        prev_row = prev.get((etf_ticker, stock_code))
        curr_row = curr.get((etf_ticker, stock_code))
        weight_prev = prev_row.get("weight") if prev_row else None
        weight_curr = curr_row.get("weight") if curr_row else None
        stock_name = (curr_row or prev_row or {}).get("stock_name")

        if prev_row is None and curr_row is not None:
            change_type = "new"
        elif prev_row is not None and curr_row is None:
            change_type = "removed"
        else:
            delta = (weight_curr or 0) - (weight_prev or 0)
            if abs(delta) < WEIGHT_THRESHOLD:
                continue
            change_type = "weight_up" if delta > 0 else "weight_down"

        weight_delta = None
        if weight_prev is not None and weight_curr is not None:
            weight_delta = weight_curr - weight_prev
        elif weight_curr is not None:
            weight_delta = weight_curr
        elif weight_prev is not None:
            weight_delta = -weight_prev

        est_flow = None
        aum = aum_by_ticker.get(etf_ticker)
        if aum is not None and weight_delta is not None:
            est_flow = aum * (weight_delta / 100.0)

        diffs.append(
            {
                "date": as_of.isoformat(),
                "etf_ticker": etf_ticker,
                "stock_code": stock_code,
                "stock_name": stock_name,
                "change_type": change_type,
                "weight_prev": weight_prev,
                "weight_curr": weight_curr,
                "weight_delta": weight_delta,
                "est_flow_krw": est_flow,
            }
        )
    return diffs


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute holdings diff")
    parser.add_argument("--date", type=str, required=True, help="Current date YYYY-MM-DD")
    parser.add_argument("--prev-date", type=str, help="Previous date YYYY-MM-DD")
    args = parser.parse_args()

    as_of = date.fromisoformat(args.date)
    prev_date = date.fromisoformat(args.prev_date) if args.prev_date else as_of - timedelta(days=1)

    with get_connection() as conn:
        prev_rows = load_holdings(conn, prev_date)
        curr_rows = load_holdings(conn, as_of)

        tickers = sorted({row["etf_ticker"] for row in curr_rows})
        aum_by_ticker = {ticker: load_meta(conn, as_of, ticker) for ticker in tickers}

        diffs = compute_diff(prev_rows, curr_rows, as_of, aum_by_ticker)
        if diffs:
            upsert_rows(
                conn,
                "holdings_diff",
                diffs,
                conflict_columns=["date", "etf_ticker", "stock_code", "change_type"],
                update_columns=[
                    "stock_name",
                    "weight_prev",
                    "weight_curr",
                    "weight_delta",
                    "est_flow_krw",
                ],
            )

    print(f"Computed {len(diffs)} diffs for {as_of.isoformat()}")


if __name__ == "__main__":
    main()
