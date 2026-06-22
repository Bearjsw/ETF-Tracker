"""Run the same query as fetchRecentChangesEnriched."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db_client import fetch_all, get_connection


def main() -> None:
    with get_connection() as conn:
        rows = fetch_all(
            conn,
            """
            SELECT
              d.*,
              u.name AS etf_name,
              u.manager,
              u.strategy_type,
              CASE
                WHEN p0.close IS NOT NULL AND p0.close > 0 AND p1.close IS NOT NULL
                THEN ((p1.close - p0.close) / p0.close * 100)
                ELSE NULL
              END AS return_since_change
            FROM holdings_diff d
            INNER JOIN etf_universe u ON u.ticker = d.etf_ticker
            LEFT JOIN prices_daily p0 ON p0.stock_code = d.stock_code AND p0.date = d.date
            LEFT JOIN LATERAL (
              SELECT close FROM prices_daily
              WHERE stock_code = d.stock_code
              ORDER BY date DESC
              LIMIT 1
            ) p1 ON TRUE
            WHERE u.strategy_type IN ('active', 'theme')
            ORDER BY d.date DESC, ABS(d.weight_delta) DESC NULLS LAST
            LIMIT 25
            """,
        )
        print("rows:", len(rows))
        if rows:
            print("sample:", {k: rows[0][k] for k in ("date", "etf_ticker", "stock_name", "manager", "change_type")})


if __name__ == "__main__":
    main()
