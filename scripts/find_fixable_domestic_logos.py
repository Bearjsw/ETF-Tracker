"""Find domestic holdings whose logo file exists but code map misses."""

from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env.local")

from gen_domestic_logo_map import (  # noqa: E402
    KRX_CODES,
    load_logos,
    match_name_to_logo,
    pick_domestic_name,
)

DOMESTIC = json.loads((ROOT / "data" / "domestic_code_logos.json").read_text(encoding="utf-8"))["codes"]


def main() -> None:
    from db_client import fetch_all, get_connection

    _, korean, domestic_ascii, _, norm_to_stem = load_logos()

    with get_connection() as conn:
        rows = fetch_all(
            conn,
            """
            SELECT stock_code, stock_name, COUNT(*)::int AS c
            FROM holdings_daily
            WHERE stock_code ~ '^[0-9]{6}$'
            GROUP BY stock_code, stock_name
            ORDER BY c DESC
            LIMIT 400
            """,
        )

    by_code: dict[str, Counter[str]] = defaultdict(Counter)
    for row in rows:
        by_code[row["stock_code"]][row["stock_name"] or ""] += row["c"]

    fixes: list[tuple[int, str, str, str]] = []
    for code, names in by_code.items():
        if code not in KRX_CODES or code in DOMESTIC:
            continue
        best = pick_domestic_name(names)
        if not best:
            continue
        matched = match_name_to_logo(best, korean, domestic_ascii, norm_to_stem)
        if matched:
            fixes.append((sum(names.values()), code, best, matched))

    fixes.sort(reverse=True)
    print(f"Fixable domestic codes: {len(fixes)}")
    for c, code, name, logo in fixes[:40]:
        print(f"  {c:5d}  {code}  {name!r}  -> {logo!r}")


if __name__ == "__main__":
    main()
