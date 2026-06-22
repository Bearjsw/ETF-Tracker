"""Impute ETF holding weights when KRX returns 0 for overseas / some active ETFs."""

from __future__ import annotations

import json
import re
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd

from overseas_ticker_resolve import resolve_overseas_ticker

CASH_NAME_RE = re.compile(r"설정현금|현금및|예금|CASH|머니마켓|MMF|원화현금|원화$", re.I)

WEIGHT_KEYS = ("비중", "계약수량비중")
AMOUNT_KEYS = ("금액", "시가총액")
QTY_KEYS = ("계약수", "계약수량", "수량")

ROOT = Path(__file__).resolve().parents[1]
KRX_LISTED_PATH = ROOT / "data" / "krx_listed_codes.json"


def is_cash_name(stock_name: str | None) -> bool:
    name = (stock_name or "").strip()
    return bool(name and CASH_NAME_RE.search(name))


def parse_weight(row: Any) -> float | None:
    for key in WEIGHT_KEYS:
        value = row.get(key) if hasattr(row, "get") else None
        if value is not None and pd.notna(value):
            weight = float(value)
            if weight > 0:
                return weight
    return None


def parse_eval_amount(row: Any) -> float | None:
    for key in AMOUNT_KEYS:
        value = row.get(key) if hasattr(row, "get") else None
        if value is not None and pd.notna(value):
            amount = float(value)
            if amount > 0:
                return amount
    return None


def parse_quantity(row: Any) -> float | None:
    for key in QTY_KEYS:
        value = row.get(key) if hasattr(row, "get") else None
        if value is not None and pd.notna(value):
            qty = float(value)
            if qty > 0:
                return qty
    return None


@lru_cache(maxsize=1)
def _krx_listed_codes() -> frozenset[str]:
    if not KRX_LISTED_PATH.exists():
        return frozenset()
    try:
        payload = json.loads(KRX_LISTED_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return frozenset()
    if isinstance(payload, list):
        return frozenset(str(code).zfill(6)[-6:] for code in payload)
    if isinstance(payload, dict):
        return frozenset(str(code).zfill(6)[-6:] for code in payload.keys())
    return frozenset()


@lru_cache(maxsize=8)
def fetch_usdkrw(as_of: date) -> float:
    import FinanceDataReader as fdr

    start = as_of - timedelta(days=14)
    try:
        df = fdr.DataReader("USD/KRW", start.isoformat(), as_of.isoformat())
        if df is not None and not df.empty:
            close_col = "Close" if "Close" in df.columns else df.columns[-1]
            value = float(df[close_col].iloc[-1])
            if value > 0:
                return value
    except Exception:
        pass
    return 1350.0


def yyyymmdd(value: date) -> str:
    return value.strftime("%Y%m%d")


@lru_cache(maxsize=16)
def fetch_domestic_closes(as_of: date) -> dict[str, float]:
    """Bulk KRX close prices for a single trading day."""
    from pykrx import stock

    out: dict[str, float] = {}
    ymd = yyyymmdd(as_of)
    for market in ("KOSPI", "KOSDAQ", "KONEX"):
        try:
            df = stock.get_market_ohlcv_by_ticker(ymd, market)
        except Exception:
            continue
        if df is None or df.empty:
            continue
        close_col = "종가" if "종가" in df.columns else df.columns[-1]
        for ticker, row in df.iterrows():
            code = str(ticker).strip().zfill(6)[-6:]
            value = row[close_col]
            if pd.notna(value) and float(value) > 0:
                out[code] = float(value)
    return out


@lru_cache(maxsize=512)
def fetch_close(symbol: str, as_of: date) -> float | None:
    import FinanceDataReader as fdr

    start = as_of - timedelta(days=14)
    try:
        df = fdr.DataReader(symbol, start.isoformat(), as_of.isoformat())
    except Exception:
        return None
    if df is None or df.empty:
        return None
    close_col = "Close" if "Close" in df.columns else df.columns[-1]
    for value in reversed(df[close_col].tolist()):
        if pd.notna(value) and float(value) > 0:
            return float(value)
    return None


def resolve_holding_value_krw(
    row: dict[str, Any],
    as_of: date,
    usdkrw: float,
    *,
    domestic_closes: dict[str, float] | None = None,
    price_lookup: bool = True,
) -> float:
    amount = row.get("_eval_amount")
    if amount and amount > 0:
        return float(amount)

    if not price_lookup:
        return 0.0

    qty = row.get("quantity") or 0
    if qty <= 0:
        return 0.0

    overseas = resolve_overseas_ticker(row.get("stock_code"), row.get("stock_name"))
    if overseas:
        px = fetch_close(overseas, as_of)
        if px:
            return qty * px * usdkrw

    code = str(row.get("stock_code") or "").strip()
    if len(code) == 6 and code.isdigit() and code != "000000":
        listed = _krx_listed_codes()
        if listed and code not in listed:
            return 0.0
        closes = domestic_closes if domestic_closes is not None else fetch_domestic_closes(as_of)
        px = closes.get(code)
        if px:
            return qty * px
        px = fetch_close(code, as_of)
        if px:
            return qty * px

    return 0.0


def _distribution_shares(
    rows: list[dict[str, Any]],
    as_of: date,
    *,
    price_lookup: bool,
) -> list[float]:
    if not rows:
        return []

    usdkrw = fetch_usdkrw(as_of) if price_lookup else 1350.0
    domestic_closes = fetch_domestic_closes(as_of) if price_lookup else {}
    shares: list[float] = []

    for row in rows:
        val = resolve_holding_value_krw(
            row,
            as_of,
            usdkrw,
            domestic_closes=domestic_closes,
            price_lookup=price_lookup,
        )
        qty = float(row.get("quantity") or 0)
        if val > 0:
            shares.append(val)
        elif qty > 0:
            shares.append(qty)
        else:
            shares.append(0.0)
    return shares


def _assign_weights(rows: list[dict[str, Any]], shares: list[float], budget: float = 100.0) -> None:
    total = sum(shares)
    if total <= 0 or budget <= 0:
        return
    for row, share in zip(rows, shares, strict=True):
        row["weight"] = round(budget * share / total, 4) if share > 0 else 0.0


def impute_portfolio_weights(
    rows: list[dict[str, Any]],
    as_of: date,
    *,
    price_lookup: bool = True,
) -> list[dict[str, Any]]:
    """Fill weight (%) from KRX amounts, qty × price, or qty-only fallback."""
    if not rows:
        return rows

    equity_rows = [r for r in rows if not is_cash_name(r.get("stock_name"))]
    if not equity_rows:
        return rows

    missing_rows = [r for r in equity_rows if (r.get("weight") or 0) <= 0]
    if not missing_rows:
        return rows

    # KRX often reports domestic names summing to 100% while overseas rows stay at 0.
    stale_partial = any((r.get("weight") or 0) <= 0 and (r.get("quantity") or 0) > 0 for r in equity_rows)
    if stale_partial:
        target_rows = [r for r in equity_rows if (r.get("quantity") or 0) > 0]
        shares = _distribution_shares(target_rows, as_of, price_lookup=price_lookup)
        _assign_weights(target_rows, shares, 100.0)
        for row in equity_rows:
            if row not in target_rows:
                row["weight"] = 0.0
        return rows

    fixed_rows = [r for r in equity_rows if (r.get("weight") or 0) > 0]
    remaining = max(0.0, 100.0 - sum(float(r["weight"]) for r in fixed_rows))
    if remaining <= 0:
        return rows

    shares = _distribution_shares(missing_rows, as_of, price_lookup=price_lookup)
    _assign_weights(missing_rows, shares, remaining)
    return rows
