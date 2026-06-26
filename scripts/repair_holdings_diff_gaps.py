"""Fill holdings_diff for snapshot dates that have holdings_daily but no diff yet."""

from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db_client import fetch_all, get_connection

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill only missing holdings_diff dates")
    parser.add_argument("--lookback-days", type=int, default=30, help="How far back to scan for gaps")
    args = parser.parse_args()

    with get_connection() as conn:
        rows = fetch_all(
            conn,
            """
            SELECT h.date::text AS date
            FROM (SELECT DISTINCT date FROM holdings_daily) h
            LEFT JOIN (SELECT DISTINCT date FROM holdings_diff) d ON h.date = d.date
            WHERE d.date IS NULL
              AND h.date >= %s
            ORDER BY h.date
            """,
            [(date.today() - timedelta(days=args.lookback_days)).isoformat()],
        )

    if not rows:
        print("No missing holdings_diff dates in lookback window")
        return

    from_date = rows[0]["date"]
    to_date = rows[-1]["date"]
    print(f"Repairing {len(rows)} missing diff dates: {from_date} .. {to_date}")

    subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "backfill_holdings_diff.py"),
            "--from-date",
            from_date,
            "--to-date",
            to_date,
        ],
        cwd=ROOT,
        check=True,
    )


if __name__ == "__main__":
    main()
