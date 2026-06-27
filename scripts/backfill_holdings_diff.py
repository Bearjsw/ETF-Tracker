"""Backfill holdings_diff for every holdings_daily snapshot date."""

from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from compute_holdings_diff import compute_diff, load_holdings, load_meta, load_median_aum, resolve_prev_date
from db_client import fetch_all, get_connection, upsert_rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill holdings_diff for all snapshot dates")
    parser.add_argument("--from-date", type=str, default=None, help="Start date YYYY-MM-DD (inclusive)")
    parser.add_argument("--to-date", type=str, default=None, help="End date YYYY-MM-DD (inclusive)")
    args = parser.parse_args()

    with get_connection() as conn:
        clauses = ["1=1"]
        params: list[str] = []
        if args.from_date:
            clauses.append("date >= %s")
            params.append(args.from_date)
        if args.to_date:
            clauses.append("date <= %s")
            params.append(args.to_date)

        dates = fetch_all(
            conn,
            f"""
            SELECT DISTINCT date::text AS date
            FROM holdings_daily
            WHERE {' AND '.join(clauses)}
            ORDER BY date
            """,
            params,
        )

        total = 0
        for row in dates:
            as_of = date.fromisoformat(str(row["date"]))
            prev_date = resolve_prev_date(conn, as_of, None)
            prev_rows = load_holdings(conn, prev_date)
            curr_rows = load_holdings(conn, as_of)
            if not curr_rows:
                continue

            prev_etfs = len({r["etf_ticker"] for r in prev_rows})
            curr_etfs = len({r["etf_ticker"] for r in curr_rows})
            if prev_etfs > curr_etfs * 3 and curr_etfs < 100:
                print(
                    f"{as_of.isoformat()}: skip diff (prev {prev_etfs} ETFs vs curr {curr_etfs} ETFs — mixed snapshot)"
                )
                continue

            tickers = sorted({r["etf_ticker"] for r in curr_rows})
            aum_by_ticker = {ticker: load_meta(conn, as_of, ticker) for ticker in tickers}
            median_aum = load_median_aum(conn)
            diffs = compute_diff(prev_rows, curr_rows, as_of, aum_by_ticker)
            if not diffs:
                print(f"{as_of.isoformat()}: 0 diffs (prev {prev_date.isoformat()})")
                continue

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
            total += len(diffs)
            print(f"{as_of.isoformat()}: {len(diffs)} diffs (prev {prev_date.isoformat()})")

        print(f"Done: {total} diff rows upserted across {len(dates)} snapshot dates")


if __name__ == "__main__":
    main()
