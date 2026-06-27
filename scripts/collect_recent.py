"""Collect ETF holdings for every business day since the latest snapshot, then
run downstream diff/signal/price repairs in one pass.

Usage:
  python -u scripts/collect_recent.py                 # latest snapshot+1 .. yesterday
  python -u scripts/collect_recent.py --from 2026-06-18 --to 2026-06-25
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db_client import fetch_all, get_connection

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
PY = sys.executable


def run(cmd: list[str]) -> None:
    print(f"\n>>> {' '.join(cmd)}", flush=True)
    subprocess.run(cmd, cwd=ROOT, check=True)


def latest_holdings_date() -> date | None:
    with get_connection() as conn:
        rows = fetch_all(conn, "SELECT MAX(date)::text AS d FROM holdings_daily")
    d = rows[0]["d"] if rows else None
    return date.fromisoformat(d) if d else None


def business_days(start: date, end: date) -> list[date]:
    days: list[date] = []
    cur = start
    while cur <= end:
        if cur.weekday() < 5:  # Mon-Fri
            days.append(cur)
        cur += timedelta(days=1)
    return days


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect recent holdings + downstream repairs")
    parser.add_argument("--from", dest="from_date", type=str, default=None)
    parser.add_argument("--to", dest="to_date", type=str, default=None)
    parser.add_argument(
        "--dates",
        type=str,
        default=None,
        help="Explicit comma-separated trading days (YYYY-MM-DD); skips business-day inference and holidays",
    )
    parser.add_argument("--limit", type=int, default=None, help="Max ETFs per day (debug)")
    parser.add_argument("--workers", type=int, default=8, help="Concurrent fetch threads per day")
    parser.add_argument("--skip-prices", action="store_true", help="Skip stock price + NAV collection")
    args = parser.parse_args()

    if args.dates:
        days = [date.fromisoformat(d.strip()) for d in args.dates.split(",") if d.strip()]
    else:
        if args.from_date:
            start = date.fromisoformat(args.from_date)
        else:
            latest = latest_holdings_date()
            if latest is None:
                print("No holdings_daily rows found; aborting.")
                return
            start = latest + timedelta(days=1)

        end = date.fromisoformat(args.to_date) if args.to_date else date.today() - timedelta(days=1)
        days = business_days(start, end)
    if not days:
        # 새로 수집할 영업일이 없어도 후처리는 멱등하므로 갱신을 이어간다
        # (갭 복구·종가/NAV 최신화). 데이터가 이미 최신이면 빠르게 끝난다.
        print("No new business days to collect; running downstream only.", flush=True)
    else:
        print(f"Collecting {len(days)} business day(s): {days[0]} .. {days[-1]}", flush=True)
        for d in days:
            cmd = [PY, "-u", str(SCRIPTS / "collect_daily.py"), "--date", d.isoformat()]
            cmd += ["--workers", str(args.workers)]
            if args.limit:
                cmd += ["--limit", str(args.limit)]
            run(cmd)

    # Downstream: fill diffs + signals for any new dates, refresh prices/NAV/flows.
    # lookback은 가장 오래된 수집일을 덮도록 동적으로 잡는다 (과거 백필 대응).
    earliest = min(days) if days else date.today()
    lookback = max(21, (date.today() - earliest).days + 2)
    run([PY, "-u", str(SCRIPTS / "repair_holdings_diff_gaps.py"), "--lookback-days", str(lookback)])
    run([PY, "-u", str(SCRIPTS / "repair_signal_gaps.py"), "--lookback-days", str(lookback)])

    if not args.skip_prices:
        run([PY, "-u", str(SCRIPTS / "collect_stock_prices.py"), "--days", "365"])
        run([PY, "-u", str(SCRIPTS / "collect_etf_nav_history.py"), "--days", "365", "--limit", "600", "--all-crawl"])
        # AUM(설정액)은 NAV 수집 단계에서 채워지지 않으므로 별도 백필이 필요하다.
        # 수집한 날짜(없으면 최신 보유 스냅샷)의 비어 있는 AUM을 채운다.
        aum_dates = days if days else [d for d in [latest_holdings_date()] if d]
        for d in aum_dates:
            run([PY, "-u", str(SCRIPTS / "backfill_etf_meta.py"), "--date", d.isoformat(), "--refetch-portfolio"])
        run([PY, "-u", str(SCRIPTS / "backfill_est_flow.py"), "--recalculate"])

    print("\ncollect_recent complete.", flush=True)


if __name__ == "__main__":
    main()
