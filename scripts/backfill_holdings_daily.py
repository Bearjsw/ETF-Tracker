"""Backfill KRX ETF holdings + diffs for multiple trading days."""

from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db_client import fetch_all, get_connection

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = Path(__file__).resolve().parent
PY = sys.executable

FULL_SNAPSHOT_MIN_ETFS = 450


def trading_days(end: date, count: int) -> list[date]:
    days: list[date] = []
    cur = end
    while len(days) < count:
        if cur.weekday() < 5:
            days.append(cur)
        cur -= timedelta(days=1)
    return sorted(days)


def snapshot_etf_count(conn, as_of: date) -> int:
    rows = fetch_all(
        conn,
        "SELECT COUNT(DISTINCT etf_ticker)::int AS c FROM holdings_daily WHERE date = %s",
        [as_of.isoformat()],
    )
    return int(rows[0]["c"] if rows else 0)


def run(cmd: list[str]) -> None:
    print(f"\n>>> {' '.join(cmd)}", flush=True)
    subprocess.run(cmd, cwd=ROOT, check=True)


def purge_partial_snapshots(conn, dates: list[date], min_etfs: int) -> list[date]:
    purged: list[date] = []
    for as_of in dates:
        if snapshot_etf_count(conn, as_of) >= min_etfs:
            continue
        if snapshot_etf_count(conn, as_of) == 0:
            continue
        d = as_of.isoformat()
        print(f"Purge partial snapshot {d} ({snapshot_etf_count(conn, as_of)} ETFs)", flush=True)
        with conn.cursor() as cur:
            cur.execute("DELETE FROM holdings_diff WHERE date = %s", [d])
            cur.execute("DELETE FROM holdings_daily WHERE date = %s", [d])
            cur.execute("DELETE FROM etf_meta_daily WHERE date = %s", [d])
        conn.commit()
        purged.append(as_of)
    return purged


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill holdings_daily + holdings_diff for trading days")
    parser.add_argument("--end-date", type=str, default=date.today().isoformat())
    parser.add_argument("--days", type=int, default=20, help="Number of trading days to ensure")
    parser.add_argument("--limit", type=int, default=None, help="Max ETFs per day (default: all crawl-enabled)")
    parser.add_argument("--skip-collect", action="store_true", help="Only recompute diffs/flows")
    parser.add_argument("--skip-weights", action="store_true", help="Skip weight backfill after each day")
    parser.add_argument("--skip-meta", action="store_true", help="Skip AUM backfill after each day")
    parser.add_argument("--force", action="store_true", help="Re-fetch even if snapshot looks complete")
    args = parser.parse_args()

    end = date.fromisoformat(args.end_date)
    targets = trading_days(end, args.days)

    with get_connection() as conn:
        existing = fetch_all(
            conn,
            """
            SELECT date::text AS d, COUNT(DISTINCT etf_ticker)::int AS etfs
            FROM holdings_daily
            GROUP BY date
            ORDER BY date
            """,
        )
        print("Existing snapshots:", existing)
        purge_partial_snapshots(conn, targets, FULL_SNAPSHOT_MIN_ETFS)

    if not args.skip_collect:
        for as_of in targets:
            with get_connection() as conn:
                etf_count = snapshot_etf_count(conn, as_of)
            if etf_count >= FULL_SNAPSHOT_MIN_ETFS and not args.force:
                print(f"Skip collect {as_of.isoformat()} — already {etf_count} ETFs", flush=True)
                continue

            cmd = [PY, str(SCRIPTS / "collect_daily.py"), "--date", as_of.isoformat()]
            if args.limit:
                cmd.extend(["--limit", str(args.limit)])
            if args.force or etf_count > 0:
                cmd.append("--force")
            run(cmd)

            if not args.skip_weights:
                weight_cmd = [
                    PY,
                    str(SCRIPTS / "backfill_holdings_weights.py"),
                    "--date",
                    as_of.isoformat(),
                    "--fast",
                ]
                run(weight_cmd)

            if not args.skip_meta:
                meta_cmd = [
                    PY,
                    str(SCRIPTS / "backfill_etf_meta.py"),
                    "--date",
                    as_of.isoformat(),
                    "--refetch-portfolio",
                ]
                run(meta_cmd)

    if not args.skip_meta and args.skip_collect:
        print("\n>>> Backfill AUM for all snapshot dates missing AUM", flush=True)
        run([PY, str(SCRIPTS / "backfill_etf_meta.py"), "--refetch-portfolio"])

    if not args.skip_weights and args.skip_collect:
        print("\n>>> Backfill weights for all snapshots with missing weights", flush=True)
        run([PY, str(SCRIPTS / "backfill_holdings_weights.py"), "--fast"])

    for as_of in targets:
        with get_connection() as conn:
            if snapshot_etf_count(conn, as_of) == 0:
                print(f"Skip diff {as_of.isoformat()} — no holdings", flush=True)
                continue
        run([PY, str(SCRIPTS / "compute_holdings_diff.py"), "--date", as_of.isoformat()])
        run([PY, str(SCRIPTS / "compute_signals.py"), "--date", as_of.isoformat()])

    run([PY, str(SCRIPTS / "backfill_est_flow.py")])

    with get_connection() as conn:
        summary = fetch_all(
            conn,
            """
            SELECT date::text AS d, COUNT(DISTINCT etf_ticker)::int AS etfs
            FROM holdings_daily
            GROUP BY date
            ORDER BY date
            """,
        )
        diffs = fetch_all(
            conn,
            """
            SELECT date::text AS d, COUNT(*)::int AS cnt
            FROM holdings_diff
            GROUP BY date
            ORDER BY date
            """,
        )
    print("\n=== holdings_daily ===", summary)
    print("=== holdings_diff ===", diffs)


if __name__ == "__main__":
    main()
