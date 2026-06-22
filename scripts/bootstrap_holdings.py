"""Bootstrap holdings_daily with sample snapshots for top active ETFs.

Used when KRX credentials are not yet configured. Seeds two dates so
compute_holdings_diff / compute_signals can run immediately.
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db_client import fetch_all, get_connection, upsert_rows

# Major KOSPI/KOSDAQ names for plausible active ETF portfolios
STOCK_POOL: list[tuple[str, str, float]] = [
    ("005930", "삼성전자", 8.5),
    ("000660", "SK하이닉스", 6.2),
    ("005380", "현대차", 4.1),
    ("035420", "NAVER", 3.8),
    ("051910", "LG화학", 3.2),
    ("006400", "삼성SDI", 2.9),
    ("035720", "카카오", 2.5),
    ("003670", "포스코퓨처엠", 2.2),
    ("068270", "셀트리온", 2.0),
    ("105560", "KB금융", 1.8),
    ("055550", "신한지주", 1.6),
    ("012330", "현대모비스", 1.5),
    ("028260", "삼성물산", 1.4),
    ("066570", "LG전자", 1.3),
    ("032830", "삼성생명", 1.2),
]

EXTRA_STOCKS: list[tuple[str, str, float]] = [
    ("207940", "삼성바이오로직스", 2.1),
    ("373220", "LG에너지솔루션", 1.9),
    ("000270", "기아", 1.7),
]


def top_etfs(conn, limit: int) -> list[dict[str, Any]]:
    return fetch_all(
        conn,
        """
        SELECT u.ticker, u.name, u.strategy_type, m.aum, m.nav, m.listed_shares
        FROM etf_universe u
        JOIN LATERAL (
            SELECT aum, nav, listed_shares, date
            FROM etf_meta_daily
            WHERE etf_ticker = u.ticker
            ORDER BY date DESC
            LIMIT 1
        ) m ON TRUE
        WHERE u.strategy_type IN ('active', 'theme')
          AND u.is_listed = TRUE
          AND u.crawl_enabled = TRUE
        ORDER BY m.aum DESC NULLS LAST
        LIMIT %s
        """,
        [limit],
    )


def holding_row(etf_ticker: str, as_of: date, code: str, name: str, weight: float) -> dict[str, Any]:
    w = round(weight, 2)
    return {
        "date": as_of.isoformat(),
        "etf_ticker": etf_ticker,
        "stock_code": code,
        "stock_name": name,
        "weight": w,
        "quantity": int(w * 10000),
    }


def build_transition_pair(
    etf_ticker: str,
    prev_date: date,
    curr_date: date,
    *,
    offset: int = 0,
    extra_stock: tuple[str, str, float],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Prev → curr with 매수·매도·편입·편출이 모두 나오도록 샘플 스냅샷 생성."""
    pool = STOCK_POOL[offset:] + STOCK_POOL[:offset]
    active = pool[:11]

    prev_rows = [holding_row(etf_ticker, prev_date, code, name, weight) for code, name, weight in active]

    curr_rows: list[dict[str, Any]] = []
    for j, (code, name, weight) in enumerate(active):
        if j in (5, 9):
            continue
        if j == 3:
            curr_rows.append(holding_row(etf_ticker, curr_date, code, name, weight * 0.72))
        elif j in (0, 1, 2):
            curr_rows.append(holding_row(etf_ticker, curr_date, code, name, weight * 1.05))
        else:
            curr_rows.append(holding_row(etf_ticker, curr_date, code, name, weight * 1.01))

    extra_code, extra_name, extra_weight = extra_stock
    curr_rows.append(holding_row(etf_ticker, curr_date, extra_code, extra_name, extra_weight))
    return prev_rows, curr_rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Bootstrap sample holdings into Postgres")
    parser.add_argument("--limit", type=int, default=25, help="Number of ETFs to seed")
    parser.add_argument("--date", type=str, help="Current date YYYY-MM-DD (default: today)")
    args = parser.parse_args()

    curr = date.fromisoformat(args.date) if args.date else date.today()
    prev = curr - timedelta(days=1)

    with get_connection() as conn:
        etfs = top_etfs(conn, args.limit)
        if not etfs:
            print("No active ETFs found in universe")
            raise SystemExit(1)

        holdings_count = 0
        for i, etf in enumerate(etfs):
            ticker = etf["ticker"]
            extra = EXTRA_STOCKS[i % len(EXTRA_STOCKS)]
            prev_rows, curr_rows = build_transition_pair(
                ticker,
                prev,
                curr,
                offset=i % 3,
                extra_stock=extra,
            )
            holdings_count += upsert_rows(
                conn,
                "holdings_daily",
                prev_rows + curr_rows,
                conflict_columns=["date", "etf_ticker", "stock_code"],
                update_columns=["stock_name", "weight", "quantity"],
            )
            if etf.get("aum") is not None:
                upsert_rows(
                    conn,
                    "etf_meta_daily",
                    [
                        {"date": prev.isoformat(), "etf_ticker": ticker, "aum": etf["aum"], "nav": etf.get("nav"), "listed_shares": etf.get("listed_shares")},
                        {"date": curr.isoformat(), "etf_ticker": ticker, "aum": etf["aum"], "nav": etf.get("nav"), "listed_shares": etf.get("listed_shares")},
                    ],
                    conflict_columns=["date", "etf_ticker"],
                    update_columns=["aum", "nav", "listed_shares"],
                )

        print(f"Seeded {holdings_count} holdings rows for {len(etfs)} ETFs ({prev} → {curr})")


if __name__ == "__main__":
    main()
