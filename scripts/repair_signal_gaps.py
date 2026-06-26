"""Fill signals_daily for diff dates that have holdings_diff but no signals yet."""

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
    parser = argparse.ArgumentParser(description="Backfill only missing signals_daily dates")
    parser.add_argument("--lookback-days", type=int, default=60, help="How far back to scan for gaps")
    args = parser.parse_args()

    with get_connection() as conn:
        rows = fetch_all(
            conn,
            """
            SELECT d.date::text AS date
            FROM (SELECT DISTINCT date FROM holdings_diff) d
            LEFT JOIN (SELECT DISTINCT date FROM signals_daily) s ON d.date = s.date
            WHERE s.date IS NULL
              AND d.date >= %s
            ORDER BY d.date
            """,
            [(date.today() - timedelta(days=args.lookback_days)).isoformat()],
        )

    if not rows:
        print("No missing signals_daily dates in lookback window")
        return

    missing = [r["date"] for r in rows]
    print(f"Repairing {len(missing)} missing signal dates: {missing[0]} .. {missing[-1]}")

    for as_of in missing:
        subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "compute_signals.py"), "--date", as_of],
            cwd=ROOT,
            check=True,
        )


if __name__ == "__main__":
    main()
