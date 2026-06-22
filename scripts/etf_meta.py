"""ETF AUM / NAV helpers — pykrx OHLCV lacks AUM; derive from portfolio file or holdings."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

import pandas as pd


def normalize_pykrx_ticker(ticker: str) -> str:
    if ticker.startswith("A") and len(ticker) > 1:
        return ticker[1:]
    return ticker


def yyyymmdd(value: date) -> str:
    return value.strftime("%Y%m%d")


def compute_aum_from_portfolio_df(df: pd.DataFrame | None) -> float | None:
    """Sum KRX portfolio deposit 금액 (and positive 시가총액) for total ETF net assets."""
    if df is None or df.empty:
        return None

    total = 0.0
    for col in ("금액", "시가총액"):
        if col not in df.columns:
            continue
        series = pd.to_numeric(df[col], errors="coerce").fillna(0)
        total += float(series[series > 0].sum())
    return total if total > 0 else None


def compute_aum_from_holdings(
    holdings: list[dict[str, Any]],
    as_of: date,
    *,
    price_lookup: bool = True,
) -> float | None:
    """Estimate AUM as sum of constituent evaluation amounts (qty × price)."""
    if not holdings:
        return None

    from portfolio_weight import fetch_domestic_closes, fetch_usdkrw, resolve_holding_value_krw

    usdkrw = fetch_usdkrw(as_of)
    domestic = fetch_domestic_closes(as_of) if price_lookup else {}
    total = 0.0
    for row in holdings:
        val = resolve_holding_value_krw(
            row,
            as_of,
            usdkrw,
            domestic_closes=domestic,
            price_lookup=price_lookup,
        )
        if val > 0:
            total += val
    return total if total > 0 else None


def fetch_etf_nav_and_close(ticker: str, as_of: date) -> tuple[float | None, float | None]:
    from pykrx import stock

    pykrx_ticker = normalize_pykrx_ticker(ticker)
    start = as_of - timedelta(days=14)

    try:
        df = stock.get_etf_price_deviation(yyyymmdd(start), yyyymmdd(as_of), pykrx_ticker)
        if df is not None and not df.empty:
            last = df.iloc[-1]
            nav = float(last["NAV"]) if "NAV" in last.index and pd.notna(last["NAV"]) else None
            close = float(last["종가"]) if "종가" in last.index and pd.notna(last["종가"]) else None
            if nav or close:
                return nav, close
    except Exception:
        pass

    try:
        df = stock.get_etf_ohlcv_by_date(yyyymmdd(start), yyyymmdd(as_of), pykrx_ticker)
    except Exception:
        df = None

    if df is None or df.empty:
        return None, None

    last = df.iloc[-1]
    nav = None
    close = None
    for col in df.columns:
        label = str(col)
        if "NAV" in label.upper():
            nav = float(last[col]) if pd.notna(last[col]) else nav
        if label == "종가":
            close = float(last[col]) if pd.notna(last[col]) else close
    return nav, close


def scale_aum_from_baseline(
    nav: float | None,
    baseline_aum: float | None,
    baseline_nav: float | None,
) -> float | None:
    if nav is None or baseline_aum is None or baseline_nav is None:
        return None
    if baseline_aum <= 0 or baseline_nav <= 0 or nav <= 0:
        return None
    return round(float(baseline_aum) * (float(nav) / float(baseline_nav)), 2)


def resolve_listed_shares(aum: float | None, nav: float | None) -> int | None:
    if aum is None or nav is None or aum <= 0 or nav <= 0:
        return None
    return int(round(aum / nav))


def build_meta(
    ticker: str,
    as_of: date,
    *,
    portfolio_df: pd.DataFrame | None = None,
    holdings: list[dict[str, Any]] | None = None,
    baseline_aum: float | None = None,
    baseline_nav: float | None = None,
    holdings_price_lookup: bool = True,
) -> dict[str, Any]:
    nav, _close = fetch_etf_nav_and_close(ticker, as_of)

    portfolio_aum = compute_aum_from_portfolio_df(portfolio_df)
    aum = portfolio_aum
    if aum is None and holdings:
        price_lookup = holdings_price_lookup or portfolio_df is not None
        aum = compute_aum_from_holdings(holdings, as_of, price_lookup=price_lookup)
    if aum is None:
        aum = scale_aum_from_baseline(nav, baseline_aum, baseline_nav)

    listed_shares = resolve_listed_shares(aum, nav)
    return {
        "aum": round(aum, 2) if aum is not None else None,
        "nav": round(nav, 4) if nav is not None else None,
        "listed_shares": listed_shares,
    }
