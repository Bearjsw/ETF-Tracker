"""Validate domestic/equity filters against holdings (requires built TS logic mirror in Python)."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from stock_filter import is_trackable_stock

krx = set(json.loads((ROOT / "data/krx_listed_codes.json").read_text(encoding="utf-8"))["codes"])
text = (ROOT / "lib/overseas-ticker-map.ts").read_text(encoding="utf-8")
overseas = set(re.findall(r'"(\d{6})":', text))

NON_EQ = re.compile(
    r"설정현금|머니마켓|MMF|양도성예금|스왑|SWAP|TRS|총수익|국채\s*F|국채선물|\(CP\)|\(CD\)|채권\d",
    re.I,
)
BOND = re.compile(r"국고|국채|통안|금융채|회사채|해외.*채", re.I)
BOND_ETF = re.compile(r"^(KODEX|TIGER|ARIRANG|RISE|SOL|ACE|HANARO|PLUS|1Q)\b.*(채|국고|머니|CD|금융)", re.I)


def is_non_equity(name: str) -> bool:
    return bool(NON_EQ.search(name) or BOND_ETF.search(name))


def is_listed_equity(code: str, name: str) -> bool:
    if not is_trackable_stock(code, name):
        return False
    if is_non_equity(name):
        return False
    if BOND.search(name):
        return False
    if code in overseas:
        return False
    return code in krx


def is_domestic(code: str, name: str) -> bool:
    if code in overseas:
        return False
    if code in krx:
        return True
    if BOND.search(name) or is_non_equity(name):
        return True
    return code not in overseas


def main() -> None:
    from db_client import fetch_all, get_connection

    with get_connection() as conn:
        rows = fetch_all(
            conn,
            """
            SELECT stock_code, MAX(stock_name) AS stock_name
            FROM holdings_daily
            GROUP BY stock_code
            ORDER BY COUNT(*) DESC
            LIMIT 800
            """,
        )

    domestic_equity = []
    bad = []
    for row in rows:
        code = str(row["stock_code"])
        name = (row["stock_name"] or "").strip()
        if not is_domestic(code, name):
            continue
        if is_listed_equity(code, name):
            domestic_equity.append((code, name))
        elif not BOND.search(name) and not is_non_equity(name):
            bad.append((code, name))

    print(f"domestic equity (top 800 holdings): {len(domestic_equity)}")
    print(f"suspicious in domestic non-equity: {len(bad)}")
    for code, name in bad[:25]:
        print(f"  {code}  {name}")


if __name__ == "__main__":
    main()
