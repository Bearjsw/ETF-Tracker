"""Diagnose stock market/category classification for holdings."""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from stock_filter import is_trackable_stock

krx = set(json.loads((ROOT / "data/krx_listed_codes.json").read_text(encoding="utf-8"))["codes"])
text = (ROOT / "lib/overseas-ticker-map.ts").read_text(encoding="utf-8")
overseas_codes = set(re.findall(r'"(\d{6})":', text))

BOND = re.compile(
    r"국고|국채|통안|금융채|회사채|사채|CP\)|단기사채|채권\d|해외.*채|TREASURY|AGGREGATE BOND",
    re.I,
)


def main() -> None:
    from db_client import fetch_all, get_connection

    with get_connection() as conn:
        rows = fetch_all(
            conn,
            """
            SELECT stock_code, MAX(stock_name) AS stock_name, COUNT(*) AS c
            FROM holdings_daily
            WHERE stock_code ~ '^[0-9]{6}$' AND stock_code <> '000000'
            GROUP BY stock_code
            ORDER BY c DESC
            """,
        )

    issues: list[tuple[str, str, str | None]] = []
    for row in rows:
        code = str(row["stock_code"])
        name = row["stock_name"]
        if not is_trackable_stock(code, name):
            issues.append(("non_trackable", code, name))
            continue
        in_krx = code in krx
        in_os = code in overseas_codes
        bond = bool(name and BOND.search(name))
        if in_krx and bond:
            issues.append(("krx_but_bond_name", code, name))
        if not in_krx and in_os:
            issues.append(("overseas_proxy", code, name))
        if not in_krx and not in_os and not bond:
            issues.append(("unknown_6digit", code, name))

    counts = Counter(kind for kind, _, _ in issues)
    print("Total codes:", len(rows))
    print("Issues:", dict(counts))
    for kind in sorted(counts):
        print(f"\n--- {kind} ({counts[kind]}) ---")
        for t, code, name in issues:
            if t == kind:
                print(f"  {code}  {name}")


if __name__ == "__main__":
    main()
