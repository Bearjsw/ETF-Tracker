"""
Generate domestic (KRX) and US listed stock universes for market classification.

Sources (via FinanceDataReader, same family as KRX KIND listed issues):
  - KOSPI + KOSDAQ → data/krx_listed_codes.json
  - NASDAQ + NYSE + AMEX → data/us_listed_tickers.json

KRX KIND reference: https://kind.krx.co.kr/corpgeneral/listedIssueStatus.do?method=loadInitPage
US listing reference: FinanceDataReader StockListing (see lazyquant tistory guide)

Run periodically (e.g. weekly) to pick up IPO/delisting:
  python scripts/gen_stock_universe_maps.py
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def is_korean_stock_code(code: str) -> bool:
    return len(code) == 6 and code.isdigit() and code != "000000"


def fetch_krx_listed_codes() -> list[str]:
    import FinanceDataReader as fdr

    codes: set[str] = set()
    for market in ("KOSPI", "KOSDAQ"):
        print(f"Fetching {market}...")
        df = fdr.StockListing(market)
        col = "Code" if "Code" in df.columns else "Symbol" if "Symbol" in df.columns else df.columns[0]
        for raw in df[col].astype(str):
            digits = "".join(ch for ch in raw if ch.isdigit()).zfill(6)[-6:]
            if is_korean_stock_code(digits):
                codes.add(digits)
    return sorted(codes)


def fetch_us_listed_tickers() -> list[str]:
    import FinanceDataReader as fdr

    tickers: set[str] = set()
    for market in ("NASDAQ", "NYSE", "AMEX"):
        print(f"Fetching {market}...")
        try:
            df = fdr.StockListing(market)
        except Exception as exc:
            print(f"WARN {market}: {exc}")
            continue
        col = "Symbol" if "Symbol" in df.columns else "Code"
        for raw in df[col].astype(str):
            t = raw.strip().upper()
            if t and t != "NAN":
                tickers.add(t)
    return sorted(tickers)


def main() -> None:
    try:
        import FinanceDataReader  # noqa: F401
    except ImportError:
        print("Install FinanceDataReader: pip install finance-datareader", file=sys.stderr)
        sys.exit(1)

    DATA.mkdir(parents=True, exist_ok=True)
    today = date.today().isoformat()

    krx = fetch_krx_listed_codes()
    us = fetch_us_listed_tickers()

    krx_payload = {"updated": today, "source": "FinanceDataReader KOSPI+KOSDAQ", "codes": krx}
    us_payload = {"updated": today, "source": "FinanceDataReader NASDAQ+NYSE+AMEX", "tickers": us}

    (DATA / "krx_listed_codes.json").write_text(
        json.dumps(krx_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (DATA / "us_listed_tickers.json").write_text(
        json.dumps(us_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Wrote {len(krx)} KRX codes → data/krx_listed_codes.json")
    print(f"Wrote {len(us)} US tickers → data/us_listed_tickers.json")


if __name__ == "__main__":
    main()
