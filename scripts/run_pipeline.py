"""Run full data pipeline: collect (optional) → diff → signals."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from datetime import date
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env.local")
load_dotenv(ROOT / ".env")


def run(cmd: list[str]) -> None:
    print(f"\n>>> {' '.join(cmd)}")
    subprocess.run(cmd, cwd=ROOT, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run ETF-Tracker data pipeline")
    parser.add_argument("--date", type=str, default=date.today().isoformat())
    parser.add_argument("--bootstrap", action="store_true", help="Seed sample holdings (no KRX needed)")
    parser.add_argument("--collect", action="store_true", help="Run collect_daily.py (requires KRX_ID/KRX_PW)")
    parser.add_argument("--limit", type=int, default=600, help="ETF limit for bootstrap/collect/nav")
    parser.add_argument("--all-prices", action="store_true", help="Backfill prices for all listed KOSPI/KOSDAQ stocks")
    args = parser.parse_args()

    as_of = date.fromisoformat(args.date)
    py = sys.executable

    if args.bootstrap or not (os.environ.get("KRX_ID") and os.environ.get("KRX_PW")):
        if not args.bootstrap and not (os.environ.get("KRX_ID") and os.environ.get("KRX_PW")):
            print("KRX_ID/KRX_PW not set — using bootstrap sample holdings")
        run([py, str(SCRIPTS / "bootstrap_holdings.py"), "--limit", str(args.limit), "--date", args.date])

    if args.collect and os.environ.get("KRX_ID") and os.environ.get("KRX_PW"):
        run([py, str(SCRIPTS / "collect_daily.py"), "--date", args.date, "--limit", str(args.limit)])
        # collect_daily saves after each ETF; re-run the same command to resume after interruption

    # prev calendar day is not always the previous holdings snapshot (weekends/holidays)
    run([py, str(SCRIPTS / "compute_holdings_diff.py"), "--date", args.date])
    run([py, str(SCRIPTS / "repair_holdings_diff_gaps.py"), "--lookback-days", "30"])
    run([py, str(SCRIPTS / "compute_signals.py"), "--date", args.date])
    run([py, str(SCRIPTS / "repair_signal_gaps.py"), "--lookback-days", "30"])
    price_cmd = [py, str(SCRIPTS / "collect_stock_prices.py"), "--days", "365"]
    if args.all_prices:
        price_cmd.append("--all-listed")
    run(price_cmd)
    run([py, str(SCRIPTS / "collect_etf_nav_history.py"), "--days", "365", "--limit", str(args.limit), "--all-crawl"])
    # AUM(설정액)은 NAV 수집 단계에서 안 채워지므로 해당 날짜를 별도 백필한다.
    if os.environ.get("KRX_ID") and os.environ.get("KRX_PW"):
        run([py, str(SCRIPTS / "backfill_etf_meta.py"), "--date", args.date, "--refetch-portfolio"])
    run([py, str(SCRIPTS / "backfill_est_flow.py"), "--recalculate"])
    print("\nPipeline complete.")


if __name__ == "__main__":
    main()
