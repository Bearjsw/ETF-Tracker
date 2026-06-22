"""Diagnose ticker mismatch between holdings_diff and etf_universe."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db_client import fetch_all, get_connection


def main() -> None:
    with get_connection() as conn:
        print("=== holdings_diff tickers (sample) ===")
        for r in fetch_all(
            conn,
            "SELECT DISTINCT etf_ticker FROM holdings_diff ORDER BY etf_ticker LIMIT 10",
        ):
            print(r)

        print("\n=== etf_universe tickers (sample active) ===")
        for r in fetch_all(
            conn,
            "SELECT ticker, strategy_type FROM etf_universe WHERE strategy_type = 'active' LIMIT 10",
        ):
            print(r)

        joined = fetch_all(
            conn,
            """
            SELECT COUNT(*)::int AS c FROM holdings_diff d
            INNER JOIN etf_universe u ON u.ticker = d.etf_ticker
            WHERE u.strategy_type IN ('active', 'theme')
            """,
        )
        print("\njoin exact ticker:", joined[0]["c"])

        stripped = fetch_all(
            conn,
            """
            SELECT COUNT(*)::int AS c FROM holdings_diff d
            INNER JOIN etf_universe u ON u.ticker = REGEXP_REPLACE(d.etf_ticker, '^A', '')
            WHERE u.strategy_type IN ('active', 'theme')
            """,
        )
        print("join strip A prefix:", stripped[0]["c"])

        unmatched = fetch_all(
            conn,
            """
            SELECT d.etf_ticker, COUNT(*)::int AS c
            FROM holdings_diff d
            LEFT JOIN etf_universe u ON u.ticker = d.etf_ticker
            WHERE u.ticker IS NULL
            GROUP BY d.etf_ticker
            ORDER BY c DESC
            LIMIT 10
            """,
        )
        print("\nunmatched diff tickers:", unmatched)


if __name__ == "__main__":
    main()
