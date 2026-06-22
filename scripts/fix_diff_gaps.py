"""Fix holdings_diff for ETFs missing intermediate bootstrap snapshots."""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from compute_holdings_diff import compute_diff, load_meta, load_median_aum
from db_client import fetch_all, get_connection, upsert_rows

WEIGHT_THRESHOLD = 0.05


def compute_pair_diff(
    prev_rows: list[dict],
    curr_rows: list[dict],
    as_of: date,
    aum_by_ticker: dict[str, float | None],
    median_aum: float,
) -> list[dict]:
    return compute_diff(prev_rows, curr_rows, as_of, aum_by_ticker, median_aum)


def main() -> None:
    with get_connection() as conn:
        print("Removing invalid 2026-06-16 diffs (bootstrap vs full KRX mismatch)...")
        with conn.cursor() as cur:
            cur.execute("DELETE FROM holdings_diff WHERE date = %s", ["2026-06-16"])
            deleted = cur.rowcount
        conn.commit()
        print(f"Deleted {deleted} rows")

        gaps = fetch_all(
            conn,
            """
            WITH latest AS (
              SELECT etf_ticker, MAX(date) AS max_date
              FROM holdings_daily
              GROUP BY etf_ticker
            ),
            prev AS (
              SELECT h.etf_ticker, MAX(h.date) AS prev_date
              FROM holdings_daily h
              JOIN latest l ON l.etf_ticker = h.etf_ticker AND h.date < l.max_date
              GROUP BY h.etf_ticker
            )
            SELECT l.etf_ticker, p.prev_date::text AS prev_date, l.max_date::text AS curr_date
            FROM latest l
            JOIN prev p ON p.etf_ticker = l.etf_ticker
            WHERE p.prev_date < l.max_date - INTERVAL '1 day'
            ORDER BY l.etf_ticker
            """,
        )

        median_aum = load_median_aum(conn)
        total = 0
        for row in gaps:
            ticker = str(row["etf_ticker"])
            prev_date = date.fromisoformat(str(row["prev_date"]))
            curr_date = date.fromisoformat(str(row["curr_date"]))

            prev_rows = fetch_all(
                conn,
                "SELECT * FROM holdings_daily WHERE date = %s AND etf_ticker = %s",
                [prev_date.isoformat(), ticker],
            )
            curr_rows = fetch_all(
                conn,
                "SELECT * FROM holdings_daily WHERE date = %s AND etf_ticker = %s",
                [curr_date.isoformat(), ticker],
            )
            if not prev_rows or not curr_rows:
                continue

            aum = load_meta(conn, curr_date, ticker)
            diffs = compute_pair_diff(prev_rows, curr_rows, curr_date, {ticker: aum}, median_aum)
            if not diffs:
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
            print(f"{ticker}: {prev_date} -> {curr_date} = {len(diffs)} diffs")

        print(f"Gap-fill complete: {total} diff rows for {len(gaps)} ETFs")

        print("Removing duplicate 'new' diffs when prior snapshot exists...")
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM holdings_diff d
                USING holdings_daily h
                WHERE d.etf_ticker = h.etf_ticker
                  AND d.stock_code = h.stock_code
                  AND d.date = (
                    SELECT MAX(date) FROM holdings_diff WHERE etf_ticker = d.etf_ticker
                  )
                  AND h.date = (
                    SELECT MAX(date) FROM holdings_daily hd
                    WHERE hd.etf_ticker = d.etf_ticker AND hd.date < d.date
                  )
                  AND d.change_type = 'new'
                """,
            )
            deduped = cur.rowcount
        conn.commit()
        print(f"Deduped {deduped} spurious new rows")


if __name__ == "__main__":
    main()
