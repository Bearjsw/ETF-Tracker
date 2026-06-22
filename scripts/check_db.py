"""Quick DB row count check."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db_client import fetch_all, get_connection

TABLES = [
    "etf_universe",
    "holdings_daily",
    "holdings_diff",
    "signals_daily",
    "etf_meta_daily",
    "prices_daily",
]


def main() -> None:
    with get_connection() as conn:
        for table in TABLES:
            rows = fetch_all(conn, f"SELECT COUNT(*)::int AS c FROM {table}")
            print(f"{table}: {rows[0]['c']}")
        crawl = fetch_all(
            conn,
            "SELECT COUNT(*)::int AS c FROM etf_universe WHERE crawl_enabled = true",
        )
        print(f"crawl_enabled: {crawl[0]['c']}")


if __name__ == "__main__":
    main()
