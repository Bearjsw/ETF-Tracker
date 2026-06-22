"""Exclude cash / placeholder rows from holdings, diffs, and signals."""

from __future__ import annotations

import re

CASH_NAME_RE = re.compile(r"설정현금|현금및|예금|CASH|머니마켓|MMF|원화현금|원화$", re.I)


def is_trackable_stock(stock_code: str | None, stock_name: str | None = None) -> bool:
    code = (stock_code or "").strip()
    if len(code) != 6 or not code.isdigit():
        return False
    if code == "000000":
        return False
    name = (stock_name or "").strip()
    if name and CASH_NAME_RE.search(name):
        return False
    return True
