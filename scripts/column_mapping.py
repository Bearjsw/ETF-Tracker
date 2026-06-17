"""ETF_ALL.xlsx column auto-detection and strategy classification."""

from __future__ import annotations

import re
from typing import Any

import pandas as pd

TICKER_KEYS = ["종목코드", "티커", "ETF코드", "단축코드", "코드", "ticker"]
NAME_KEYS = ["종목약명", "종목명", "ETF명", "펀드명", "상품명", "name"]
MANAGER_KEYS = ["운용사", "자산운용", "운용회사", "AMC", "자산운용사"]
MARKET_KEYS = ["기초시장분류", "시장", "시장구분", "거래소", "market"]
STRATEGY_KEYS = ["ETP분류", "복제추적", "지수산출방식", "운용방식", "운용형태", "운용유형", "strategy"]
LISTING_KEYS = ["상장", "listing", "상장여부", "상장상태"]
LIST_DATE_KEYS = ["상장일", "설정일", "listing_date"]
DELIST_DATE_KEYS = ["상장폐지", "폐지일", "delist"]
INDEX_KEYS = ["기초지수명", "기초지수", "추적지수", "지수명", "벤치마크", "index"]
THEME_KEYS = ["기초자산분류", "테마", "분류", "유형", "category", "섹터"]

EXTRA_STRATEGY_COLS = ["ETP분류", "복제추적", "지수산출방식", "기초지수명", "종목명", "종목약명"]


def find_col(df: pd.DataFrame, keywords: list[str]) -> str | None:
    for col in df.columns:
        label = str(col)
        lower = label.lower()
        for key in keywords:
            if key in label or key.lower() in lower:
                return label
    return None


def normalize_ticker(value: Any) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return None
    digits = re.sub(r"\D", "", text)
    if not digits:
        return None
    return digits.zfill(6)[-6:]


def classify_strategy(row: pd.Series, mapping: dict[str, str | None]) -> str:
    parts: list[str] = []
    for col in EXTRA_STRATEGY_COLS:
        if col in row.index and pd.notna(row[col]):
            parts.append(str(row[col]))
    for col in [mapping.get("strategy"), mapping.get("name"), mapping.get("index"), mapping.get("theme")]:
        if col and col in row.index and pd.notna(row[col]):
            parts.append(str(row[col]))

    blob = " ".join(parts).lower()
    if any(k in blob for k in ["액티브", "active", "active etf", "액티브etf"]):
        return "active"
    if any(k in blob for k in ["테마", "theme", "섹터", "산업", "배당", "밸류", "성장", "소부장", "2차전지"]):
        return "theme"
    if any(k in blob for k in ["패시브", "passive", "인덱스", "index", "추적", "복제"]):
        return "passive"
    if "주식" in blob and not any(
        k in blob for k in ["kospi 200", "코스피 200", "코스닥 150", "msci", "s&p", "나스닥 100"]
    ):
        return "theme"
    return "passive"


def should_crawl(strategy_type: str, is_listed: bool) -> bool:
    return is_listed and strategy_type in {"active", "theme"}


def extract_theme_tags(row: pd.Series, mapping: dict[str, str | None]) -> list[str]:
    tags: list[str] = []
    for col in ["기초자산분류", "기초지수명", "ETP분류", mapping.get("theme"), mapping.get("index")]:
        if isinstance(col, str) and col in row.index and pd.notna(row[col]):
            tags.append(str(row[col]).strip())
    return list(dict.fromkeys(t for t in tags if t))


def build_column_mapping(df: pd.DataFrame) -> dict[str, str | None]:
    return {
        "ticker": find_col(df, TICKER_KEYS),
        "name": find_col(df, NAME_KEYS),
        "manager": find_col(df, MANAGER_KEYS),
        "market": find_col(df, MARKET_KEYS),
        "strategy": find_col(df, STRATEGY_KEYS),
        "listing": find_col(df, LISTING_KEYS),
        "list_date": find_col(df, LIST_DATE_KEYS),
        "delist_date": find_col(df, DELIST_DATE_KEYS),
        "index": find_col(df, INDEX_KEYS),
        "theme": find_col(df, THEME_KEYS),
    }


def row_to_universe_record(row: pd.Series, mapping: dict[str, str | None]) -> dict[str, Any] | None:
    ticker_col = mapping.get("ticker")
    if not ticker_col:
        return None

    ticker = normalize_ticker(row.get(ticker_col))
    if not ticker:
        return None

    name_col = mapping.get("name")
    manager_col = mapping.get("manager")
    market_col = mapping.get("market")
    listing_col = mapping.get("listing")
    list_date_col = mapping.get("list_date")
    delist_date_col = mapping.get("delist_date")

    listing_val = str(row.get(listing_col, "")).strip() if listing_col else ""
    is_listed = True
    if listing_col and listing_val:
        lowered = listing_val.lower()
        if any(k in lowered for k in ["폐지", "상장폐지", "delist", "종료"]):
            is_listed = False
        elif any(k in lowered for k in ["상장", "listed", "y", "예"]):
            is_listed = True

    delist_date = None
    if delist_date_col and pd.notna(row.get(delist_date_col)):
        delist_date = pd.to_datetime(row[delist_date_col], errors="coerce")
        if pd.notna(delist_date):
            delist_date = delist_date.date().isoformat()
            is_listed = False

    strategy_type = classify_strategy(row, mapping)
    theme_tags = extract_theme_tags(row, mapping)

    list_date = None
    if list_date_col and pd.notna(row.get(list_date_col)):
        parsed = pd.to_datetime(row[list_date_col], errors="coerce")
        if pd.notna(parsed):
            list_date = parsed.date().isoformat()

    return {
        "ticker": ticker,
        "name": str(row[name_col]).strip() if name_col and pd.notna(row.get(name_col)) else ticker,
        "manager": str(row[manager_col]).strip() if manager_col and pd.notna(row.get(manager_col)) else None,
        "market": str(row[market_col]).strip() if market_col and pd.notna(row.get(market_col)) else None,
        "strategy_type": strategy_type,
        "theme_tags": theme_tags,
        "listing_date": list_date,
        "delist_date": delist_date,
        "is_listed": is_listed,
        "crawl_enabled": should_crawl(strategy_type, is_listed),
        "source": "ETF_ALL.xlsx",
    }
