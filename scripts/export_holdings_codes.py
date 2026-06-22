"""Export distinct holdings codes for diag_category_filters.ts."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db_client import fetch_all, get_connection

OUT = Path(__file__).resolve().parent / ".data" / "holdings_codes.json"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with get_connection() as conn:
        rows = fetch_all(
            conn,
            """
            SELECT stock_code, MAX(stock_name) AS stock_name
            FROM holdings_daily
            WHERE stock_code ~ '^[0-9]{6}$' AND stock_code <> '000000'
            GROUP BY stock_code
            ORDER BY COUNT(*) DESC
            """,
        )
    payload = [
        {"stock_code": str(r["stock_code"]), "stock_name": r.get("stock_name")}
        for r in rows
    ]
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(payload)} codes -> {OUT}")


if __name__ == "__main__":
    main()
