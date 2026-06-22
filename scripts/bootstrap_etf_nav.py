"""Bootstrap NAV history for chart display.

DEPRECATED — produces synthetic random-walk data. Do not run against production DB.
Use scripts/collect_etf_nav_history.py (FinanceDataReader market prices) instead.
"""

from __future__ import annotations

import argparse
import random
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db_client import fetch_all, get_connection, upsert_rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed ETF NAV history")
    parser.add_argument("--days", type=int, default=365)
    parser.add_argument("--limit", type=int, default=50)
    args = parser.parse_args()

    end = date.today()
    start = end - timedelta(days=args.days)

    with get_connection() as conn:
        etfs = fetch_all(
            conn,
            """
            SELECT u.ticker, m.nav, m.aum, m.listed_shares
            FROM etf_universe u
            JOIN LATERAL (
                SELECT nav, aum, listed_shares
                FROM etf_meta_daily
                WHERE etf_ticker = u.ticker AND nav IS NOT NULL
                ORDER BY date DESC LIMIT 1
            ) m ON TRUE
            WHERE u.crawl_enabled = TRUE
            LIMIT %s
            """,
            [args.limit],
        )

        rows: list[dict] = []
        rng = random.Random(42)
        for etf in etfs:
            base_nav = float(etf["nav"])
            base_aum = float(etf["aum"]) if etf.get("aum") else None
            nav = base_nav * (1 - args.days * 0.00015)
            d = start
            while d <= end:
                nav *= 1 + rng.uniform(-0.012, 0.014)
                aum = base_aum * (nav / base_nav) if base_aum else None
                rows.append(
                    {
                        "date": d.isoformat(),
                        "etf_ticker": etf["ticker"],
                        "aum": round(aum, 2) if aum else None,
                        "nav": round(nav, 2),
                        "listed_shares": etf.get("listed_shares"),
                    }
                )
                d += timedelta(days=1)

        count = upsert_rows(
            conn,
            "etf_meta_daily",
            rows,
            conflict_columns=["date", "etf_ticker"],
            update_columns=["aum", "nav", "listed_shares"],
        )
        print(f"Seeded {count} NAV rows for {len(etfs)} ETFs ({start} → {end})")


if __name__ == "__main__":
    main()
