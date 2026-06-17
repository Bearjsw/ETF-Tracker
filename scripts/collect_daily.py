"""Daily ETF holdings and meta collection via pykrx."""

from __future__ import annotations

import argparse
import os
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import pandas as pd
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db_client import fetch_all, get_connection, upsert_rows

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(ROOT, ".env.local"))
load_dotenv(os.path.join(ROOT, ".env"))


def krx_login() -> None:
    krx_id = os.environ.get("KRX_ID")
    krx_pw = os.environ.get("KRX_PW")
    if not krx_id or not krx_pw:
        raise RuntimeError("KRX_ID and KRX_PW are required")

    from pykrx.website.comm import auth

    auth.login(krx_id, krx_pw)


def yyyymmdd(d: date) -> str:
    return d.strftime("%Y%m%d")


def get_target_etfs(conn, tickers: list[str] | None) -> list[dict[str, Any]]:
    if tickers:
        return fetch_all(
            conn,
            """
            SELECT ticker, name FROM etf_universe
            WHERE crawl_enabled = true AND ticker = ANY(%s)
            """,
            [tickers],
        )
    return fetch_all(
        conn,
        "SELECT ticker, name FROM etf_universe WHERE crawl_enabled = true",
    )


def fetch_holdings(ticker: str, as_of: date) -> list[dict[str, Any]]:
    from pykrx import stock

    rows: list[dict[str, Any]] = []
    for offset in range(0, 7):
        target = as_of - timedelta(days=offset)
        try:
            df = stock.get_etf_portfolio_deposit_file(ticker, yyyymmdd(target))
        except Exception:
            continue
        if df is None or df.empty:
            continue

        for _, row in df.iterrows():
            code = str(row.get("종목코드", row.get("티커", ""))).strip()
            code = "".join(ch for ch in code if ch.isdigit()).zfill(6)[-6:]
            if not code:
                continue
            weight = row.get("비중", row.get("계약수량비중"))
            qty = row.get("계약수량", row.get("수량"))
            name = row.get("종목명")
            rows.append(
                {
                    "stock_code": code,
                    "stock_name": str(name) if pd.notna(name) else None,
                    "weight": float(weight) if pd.notna(weight) else None,
                    "quantity": int(qty) if pd.notna(qty) else None,
                }
            )
        if rows:
            return rows
    return rows


def fetch_meta(ticker: str, as_of: date) -> dict[str, Any]:
    from pykrx import stock

    start = as_of - timedelta(days=10)
    try:
        df = stock.get_etf_ohlcv_by_date(yyyymmdd(start), yyyymmdd(as_of), ticker)
    except Exception:
        df = None

    meta: dict[str, Any] = {"aum": None, "nav": None, "listed_shares": None}
    if df is not None and not df.empty:
        last = df.iloc[-1]
        for col in df.columns:
            label = str(col)
            if "NAV" in label.upper() or label == "종가":
                meta["nav"] = float(last[col]) if pd.notna(last[col]) else meta["nav"]
            if "시가총액" in label or "AUM" in label.upper():
                meta["aum"] = float(last[col]) if pd.notna(last[col]) else meta["aum"]
            if "상장좌" in label or "좌수" in label:
                meta["listed_shares"] = int(last[col]) if pd.notna(last[col]) else meta["listed_shares"]
    return meta


def upsert_holdings(conn, as_of: date, ticker: str, holdings: list[dict[str, Any]]) -> int:
    if not holdings:
        return 0
    payload = [
        {
            "date": as_of.isoformat(),
            "etf_ticker": ticker,
            **row,
        }
        for row in holdings
    ]
    return upsert_rows(
        conn,
        "holdings_daily",
        payload,
        conflict_columns=["date", "etf_ticker", "stock_code"],
        update_columns=["stock_name", "weight", "quantity"],
    )


def upsert_meta(conn, as_of: date, ticker: str, meta: dict[str, Any]) -> None:
    upsert_rows(
        conn,
        "etf_meta_daily",
        [{"date": as_of.isoformat(), "etf_ticker": ticker, **meta}],
        conflict_columns=["date", "etf_ticker"],
        update_columns=["aum", "nav", "listed_shares"],
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect ETF holdings via pykrx")
    parser.add_argument("--date", type=str, default=date.today().isoformat())
    parser.add_argument("--ticker", action="append", dest="tickers")
    args = parser.parse_args()

    as_of = date.fromisoformat(args.date)
    krx_login()

    results = {"ok": [], "failed": []}
    with get_connection() as conn:
        etfs = get_target_etfs(conn, args.tickers)
        for etf in etfs:
            ticker = etf["ticker"]
            try:
                holdings = fetch_holdings(ticker, as_of)
                meta = fetch_meta(ticker, as_of)
                count = upsert_holdings(conn, as_of, ticker, holdings)
                upsert_meta(conn, as_of, ticker, meta)
                results["ok"].append({"ticker": ticker, "holdings": count})
                print(f"OK {ticker}: {count} holdings")
            except Exception as exc:  # noqa: BLE001
                results["failed"].append({"ticker": ticker, "error": str(exc)})
                print(f"FAIL {ticker}: {exc}")

    print(results)
    if results["failed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
