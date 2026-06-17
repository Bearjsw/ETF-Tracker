"""Signal engine: new entry + active_rate consensus."""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db_client import fetch_all, get_connection, insert_rows, upsert_rows

WINDOWS = [5, 10, 20]
P95_MIN_SAMPLES = 20


def load_holdings_history(conn, end: date, lookback_days: int = 30) -> pd.DataFrame:
    start = end - timedelta(days=lookback_days)
    rows = fetch_all(
        conn,
        """
        SELECT date, etf_ticker, stock_code, stock_name, quantity
        FROM holdings_daily
        WHERE date >= %s AND date <= %s
        """,
        [start.isoformat(), end.isoformat()],
    )
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    return df


def load_meta_history(conn, end: date, lookback_days: int = 30) -> pd.DataFrame:
    start = end - timedelta(days=lookback_days)
    rows = fetch_all(
        conn,
        """
        SELECT date, etf_ticker, listed_shares
        FROM etf_meta_daily
        WHERE date >= %s AND date <= %s
        """,
        [start.isoformat(), end.isoformat()],
    )
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    df["listed_shares"] = df["listed_shares"].ffill()
    return df


def load_universe(conn) -> pd.DataFrame:
    rows = fetch_all(conn, "SELECT ticker, strategy_type, crawl_enabled FROM etf_universe")
    return pd.DataFrame(rows or [])


def load_new_entries(conn, as_of: date) -> list[dict[str, Any]]:
    return fetch_all(
        conn,
        """
        SELECT * FROM holdings_diff
        WHERE date = %s AND change_type = 'new'
        """,
        [as_of.isoformat()],
    )


def strength_from_score(score: float, p95: float) -> str:
    if score >= p95:
        return "strong"
    if score >= p95 * 0.6:
        return "moderate"
    return "weak"


def compute_active_rate_signals(
    holdings: pd.DataFrame,
    meta: pd.DataFrame,
    universe: pd.DataFrame,
    as_of: date,
) -> list[dict[str, Any]]:
    if holdings.empty:
        return []

    merged = holdings.merge(meta, on=["date", "etf_ticker"], how="left")
    merged = merged.merge(universe, left_on="etf_ticker", right_on="ticker", how="left")
    merged = merged[merged["crawl_enabled"] == True]  # noqa: E712
    merged.sort_values(["etf_ticker", "stock_code", "date"], inplace=True)

    signals: list[dict[str, Any]] = []
    for window in WINDOWS:
        scores: list[tuple[str, str, float, list[str]]] = []
        grouped = merged.groupby(["stock_code", "stock_name"], dropna=False)
        for (stock_code, stock_name), stock_df in grouped:
            etf_changes: list[tuple[str, float]] = []
            for etf_ticker, etf_df in stock_df.groupby("etf_ticker"):
                etf_df = etf_df.sort_values("date")
                if len(etf_df) < window + 1:
                    continue
                qty = etf_df["quantity"].astype(float)
                shares = etf_df["listed_shares"].astype(float).replace(0, np.nan)
                qty_rate = qty.pct_change(window).iloc[-1]
                share_rate = shares.pct_change(window).iloc[-1]
                if pd.isna(qty_rate) or pd.isna(share_rate):
                    continue
                active_rate = float(qty_rate - share_rate)
                if abs(active_rate) < 1e-6:
                    continue
                etf_changes.append((etf_ticker, active_rate))

            if len(etf_changes) < 2:
                continue
            pos = [t for t, v in etf_changes if v > 0]
            neg = [t for t, v in etf_changes if v < 0]
            if len(pos) >= 2:
                score = float(np.mean([v for _, v in etf_changes if v > 0]))
                scores.append((stock_code, stock_name or stock_code, score, pos))
            elif len(neg) >= 2:
                score = float(np.mean([abs(v) for _, v in etf_changes if v < 0]))
                scores.append((stock_code, stock_name or stock_code, -score, neg))

        if not scores:
            continue

        abs_scores = [abs(s[2]) for s in scores]
        p95 = float(np.percentile(abs_scores, 95)) if len(abs_scores) >= P95_MIN_SAMPLES else max(abs_scores)

        for stock_code, stock_name, score, etfs in scores:
            direction = "accumulation" if score > 0 else "distribution"
            signals.append(
                {
                    "date": as_of.isoformat(),
                    "stock_code": stock_code,
                    "stock_name": stock_name,
                    "signal_type": "consensus",
                    "direction": direction,
                    "window_days": window,
                    "etf_count": len(etfs),
                    "etf_tickers": etfs,
                    "score": abs(score),
                    "strength": strength_from_score(abs(score), p95),
                    "metadata": {"active_rate": score},
                }
            )
    return signals


def compute_new_entry_signals(conn, as_of: date) -> list[dict[str, Any]]:
    entries = load_new_entries(conn, as_of)
    if not entries:
        return []

    universe = load_universe(conn)
    theme_active = set(
        universe.loc[universe["strategy_type"].isin(["active", "theme"]), "ticker"].astype(str)
    )

    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in entries:
        if row["etf_ticker"] not in theme_active:
            continue
        grouped[row["stock_code"]].append(row)

    signals: list[dict[str, Any]] = []
    for stock_code, rows in grouped.items():
        etfs = [r["etf_ticker"] for r in rows]
        stock_name = rows[0].get("stock_name") or stock_code
        signals.append(
            {
                "date": as_of.isoformat(),
                "stock_code": stock_code,
                "stock_name": stock_name,
                "signal_type": "new_entry",
                "direction": "accumulation",
                "window_days": 1,
                "etf_count": len(etfs),
                "etf_tickers": etfs,
                "score": float(len(etfs)),
                "strength": "strong" if len(etfs) >= 3 else "moderate" if len(etfs) == 2 else "weak",
                "metadata": {"entries": rows},
            }
        )
    return signals


def upsert_signals(conn, signals: list[dict[str, Any]]) -> int:
    if not signals:
        return 0
    return upsert_rows(
        conn,
        "signals_daily",
        signals,
        conflict_columns=["date", "stock_code", "signal_type", "window_days"],
        update_columns=[
            "stock_name",
            "direction",
            "etf_count",
            "etf_tickers",
            "score",
            "strength",
            "metadata",
        ],
    )


def upsert_clusters(conn, signals: list[dict[str, Any]]) -> int:
    clusters = []
    for sig in signals:
        clusters.append(
            {
                "stock_code": sig["stock_code"],
                "stock_name": sig["stock_name"],
                "signal_type": sig["signal_type"],
                "direction": sig["direction"],
                "window_days": sig["window_days"],
                "cluster_start": sig["date"],
                "cluster_end": sig["date"],
                "etf_count": sig["etf_count"],
                "etf_tickers": sig["etf_tickers"],
                "score": sig["score"],
                "strength": sig["strength"],
                "metadata": sig.get("metadata", {}),
            }
        )
    return insert_rows(conn, "signal_clusters", clusters)


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute ETF signals")
    parser.add_argument("--date", type=str, default=date.today().isoformat())
    args = parser.parse_args()

    as_of = date.fromisoformat(args.date)

    with get_connection() as conn:
        holdings = load_holdings_history(conn, as_of)
        meta = load_meta_history(conn, as_of)
        universe = load_universe(conn)

        signals = compute_new_entry_signals(conn, as_of)
        signals.extend(compute_active_rate_signals(holdings, meta, universe, as_of))

        count = upsert_signals(conn, signals)
        cluster_count = upsert_clusters(conn, signals)

    print(f"Upserted {count} signals, {cluster_count} clusters for {as_of.isoformat()}")


if __name__ == "__main__":
    main()
