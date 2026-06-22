"""Diagnose PLUS 글로벌방산 holdings and recent diff coverage."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db_client import fetch_all, get_connection


def main() -> None:
    with get_connection() as conn:
        etfs = fetch_all(
            conn,
            """
            SELECT ticker, name, manager, strategy_type, market, crawl_enabled, is_listed
            FROM etf_universe
            WHERE name ILIKE %s
            ORDER BY name
            """,
            ["%글로벌방산%"],
        )
        print("=== ETF matches ===")
        for row in etfs:
            print(row)

        if not etfs:
            return

        ticker = etfs[0]["ticker"]
        print(f"\n=== holdings_daily for {ticker} ===")
        holdings = fetch_all(
            conn,
            """
            SELECT date::text AS date, COUNT(*)::int AS cnt,
                   COUNT(*) FILTER (WHERE weight IS NOT NULL AND weight > 0)::int AS with_weight
            FROM holdings_daily
            WHERE etf_ticker = %s
            GROUP BY date
            ORDER BY date DESC
            LIMIT 8
            """,
            [ticker],
        )
        print(holdings or "NO ROWS")

        sample = fetch_all(
            conn,
            """
            SELECT date::text AS date, stock_code, stock_name, weight, quantity
            FROM holdings_daily
            WHERE etf_ticker = %s
            ORDER BY date DESC, weight DESC NULLS LAST
            LIMIT 8
            """,
            [ticker],
        )
        print("\n=== sample rows ===")
        for row in sample:
            print(row)

        print("\n=== recent diff types (active/theme) ===")
        diffs = fetch_all(
            conn,
            """
            SELECT change_type, COUNT(*)::int AS cnt
            FROM holdings_diff d
            JOIN etf_universe u ON u.ticker = d.etf_ticker
            WHERE u.strategy_type IN ('active', 'theme')
              AND d.date >= (SELECT MAX(date) - 3 FROM holdings_diff)
            GROUP BY change_type
            ORDER BY cnt DESC
            """,
        )
        for row in diffs:
            print(row)

        print(f"\n=== diffs for {ticker} ===")
        etf_diffs = fetch_all(
            conn,
            """
            SELECT date::text AS date, change_type, COUNT(*)::int AS cnt
            FROM holdings_diff
            WHERE etf_ticker = %s
            GROUP BY date, change_type
            ORDER BY date DESC, change_type
            LIMIT 20
            """,
            [ticker],
        )
        print(etf_diffs or "NO DIFF ROWS")

        in_bootstrap = fetch_all(
            conn,
            """
            SELECT COUNT(DISTINCT etf_ticker)::int AS cnt
            FROM holdings_daily
            WHERE date = (SELECT MAX(date) FROM holdings_daily)
            """,
        )
        print("\n=== latest snapshot ETF count ===", in_bootstrap[0] if in_bootstrap else None)


if __name__ == "__main__":
    main()
