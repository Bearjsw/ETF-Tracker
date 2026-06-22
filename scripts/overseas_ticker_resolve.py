"""Resolve KRX overseas stock codes to US/global tickers for price fetch."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAP_PATH = ROOT / "scripts" / ".data" / "krx_overseas_tickers.json"

# Keep in sync with scripts/gen_overseas_ticker_map.py NAME_FRAGMENTS
NAME_FRAGMENTS: dict[str, str] = {
    "NVIDIA": "NVDA",
    "APPLE": "AAPL",
    "MICROSOFT": "MSFT",
    "ALPHABET": "GOOGL",
    "ADVANCED MICRO": "AMD",
    "APPLIED MATERIAL": "AMAT",
    "CHEVRON": "CVX",
    "CISCO": "CSCO",
    "PEPSICO": "PEP",
    "COCA-COLA": "KO",
    "COCA COLA": "KO",
    "TESLA": "TSLA",
    "BROADCOM": "AVGO",
    "PROCTER": "PG",
    "MARVELL": "MRVL",
    "COSTCO": "COST",
    "FASTENAL": "FAST",
    "MERCK": "MRK",
    "VERIZON": "VZ",
    "FORD MOTOR": "F",
    "INTL BUSINESS MACHINE": "IBM",
    "AUTOMATIC DATA": "ADP",
    "JOHNSON & JOHNSON": "JNJ",
    "AMGEN": "AMGN",
    "CATERPILLAR": "CAT",
    "UNITEDHEALTH": "UNH",
    "META PLATFORMS": "META",
    "META": "META",
    "AMAZON": "AMZN",
    "JPMORGAN": "JPM",
    "NETFLIX": "NFLX",
    "PALO ALTO": "PANW",
    "INTEL": "INTC",
    "MICRON TECHNOLOGY": "MU",
    "TAIWAN SEMICONDUCTOR": "TSM",
    "EXXON MOBIL": "XOM",
    "WALMART": "WMT",
    "DISNEY": "DIS",
    "NIKE": "NKE",
    "SALESFORCE": "CRM",
    "ORACLE": "ORCL",
    "ADOBE": "ADBE",
    "QUALCOMM": "QCOM",
    "TEXAS INSTRUMENT": "TXN",
    "BAIDU": "BIDU",
    "ASML": "ASML",
    "CLOUDFLARE": "NET",
    "GOLDMAN SACHS": "GS",
    "GENERAL MOTORS": "GM",
    "3M": "MMM",
    "LOCKHEED MARTIN": "LMT",
    "GENERAL DYNAMICS": "GD",
    "NORTHROP GRUMMAN": "NOC",
    "HOWMET AEROSPACE": "HWM",
    "HOWMET": "HWM",
    "RTX": "RTX",
    "RAYTHEON": "RTX",
    "RHEINMETALL": "RHM",
    "LEONARDO": "LDO",
    "SAAB": "SAABY",
    "BAE SYSTEMS": "BAESY",
    "BOEING": "BA",
}


def _load_code_map() -> dict[str, str]:
    if not MAP_PATH.exists():
        return {}
    try:
        return json.loads(MAP_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def resolve_overseas_ticker(stock_code: str | None, stock_name: str | None) -> str | None:
    code = (stock_code or "").strip()
    name = (stock_name or "").strip()
    code_map = _load_code_map()

    if code and code in code_map:
        return code_map[code]

    if not name:
        return None

    upper = re.sub(r"\s+", " ", name.upper())
    if re.fullmatch(r"[A-Z]{1,5}", upper):
        return upper

    for fragment, ticker in sorted(NAME_FRAGMENTS.items(), key=lambda item: -len(item[0])):
        if fragment in upper:
            return ticker

    return None


def is_overseas_stock_name(stock_name: str | None) -> bool:
    if not stock_name:
        return False
    return bool(re.search(r"[A-Z]{3,}", stock_name))


def export_code_map_from_db(conn) -> dict[str, str]:
    from db_client import fetch_all

    rows = fetch_all(
        conn,
        """
        SELECT DISTINCT stock_code, stock_name
        FROM holdings_daily
        WHERE stock_name ~ '[A-Z]{3,}'
          AND stock_code ~ '^[0-9]{6}$'
          AND stock_code <> '000000'
        """,
    )
    mapping: dict[str, str] = {}
    for row in rows:
        code = str(row["stock_code"])
        ticker = resolve_overseas_ticker(code, row.get("stock_name"))
        if ticker and code not in mapping:
            mapping[code] = ticker
    return mapping
