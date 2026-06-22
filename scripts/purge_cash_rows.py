"""Remove cash / placeholder rows from holdings tables."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db_client import get_connection

TABLES = ("holdings_daily", "holdings_diff", "signals_daily")

with get_connection() as conn:
    with conn.cursor() as cur:
        for table in TABLES:
            cur.execute(f"DELETE FROM {table} WHERE stock_code = %s", ["000000"])
            n1 = cur.rowcount
            cur.execute(f"DELETE FROM {table} WHERE stock_name ILIKE %s", ["%설정현금%"])
            n2 = cur.rowcount
            print(f"{table}: removed 000000={n1}, 설정현금={n2}")
    conn.commit()

print("Done.")
