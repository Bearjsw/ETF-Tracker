"""Seed etf_universe from ETF_ALL.xlsx."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

from column_mapping import build_column_mapping, normalize_ticker, row_to_universe_record
from db_client import get_connection, upsert_rows

DEFAULT_XLSX = Path(r"c:\Users\USER\OneDrive\문서\카카오톡 받은 파일\ETF_ALL.xlsx")


def load_dataframe(path: Path) -> pd.DataFrame:
    xl = pd.ExcelFile(path)
    preview = pd.read_excel(path, sheet_name=xl.sheet_names[0], header=None, nrows=30)
    header_row = None
    for idx in range(len(preview)):
        first = preview.iloc[idx, 0]
        if str(first).strip() == "Code":
            header_row = idx
            break
    if header_row is not None:
        return pd.read_excel(path, sheet_name=xl.sheet_names[0], header=header_row)
    return pd.read_excel(path, sheet_name=xl.sheet_names[0])


def analyze_xlsx(path: Path) -> dict:
    df = load_dataframe(path)
    mapping = build_column_mapping(df)
    records = []
    for _, row in df.iterrows():
        rec = row_to_universe_record(row, mapping)
        if rec:
            records.append(rec)

    strategy_counts: dict[str, int] = {}
    crawl_count = 0
    managers: set[str] = set()
    for rec in records:
        strategy_counts[rec["strategy_type"]] = strategy_counts.get(rec["strategy_type"], 0) + 1
        if rec["crawl_enabled"]:
            crawl_count += 1
        if rec.get("manager"):
            managers.add(rec["manager"])

    summary = {
        "path": str(path),
        "rows": len(df),
        "columns": [str(c) for c in df.columns],
        "mapping": mapping,
        "parsed_records": len(records),
        "strategy_counts": strategy_counts,
        "crawl_enabled_count": crawl_count,
        "manager_count": len(managers),
        "sample": records[:3],
    }
    return {"summary": summary, "records": records}


def upsert_records(records: list[dict], dry_run: bool = False) -> int:
    if dry_run:
        return len(records)

    with get_connection() as conn:
        now = datetime.now(timezone.utc).isoformat()
        batch_size = 200
        total = 0
        for i in range(0, len(records), batch_size):
            chunk = [{**rec, "updated_at": now} for rec in records[i : i + batch_size]]
            total += upsert_rows(
                conn,
                "etf_universe",
                chunk,
                conflict_columns=["ticker"],
                update_columns=[
                    "name",
                    "manager",
                    "market",
                    "strategy_type",
                    "theme_tags",
                    "listing_date",
                    "delist_date",
                    "is_listed",
                    "crawl_enabled",
                    "source",
                    "updated_at",
                ],
            )
    return total


def build_meta_records(path: Path, snapshot_date: str) -> list[dict]:
    df = load_dataframe(path)
    mapping = build_column_mapping(df)
    ticker_col = mapping.get("ticker")
    if not ticker_col:
        return []

    meta_rows: list[dict] = []
    for _, row in df.iterrows():
        ticker = normalize_ticker(row.get(ticker_col))
        if not ticker:
            continue
        aum = row.get("AUM")
        nav = row.get("ETF순자산가치(NAV)")
        if pd.isna(aum) and pd.isna(nav):
            continue
        meta_rows.append(
            {
                "date": snapshot_date,
                "etf_ticker": ticker,
                "aum": float(aum) if pd.notna(aum) else None,
                "nav": float(nav) if pd.notna(nav) else None,
                "listed_shares": None,
            }
        )
    return meta_rows


def upsert_meta_records(records: list[dict], dry_run: bool = False) -> int:
    if dry_run or not records:
        return len(records)

    with get_connection() as conn:
        batch_size = 200
        total = 0
        for i in range(0, len(records), batch_size):
            chunk = records[i : i + batch_size]
            total += upsert_rows(
                conn,
                "etf_meta_daily",
                chunk,
                conflict_columns=["date", "etf_ticker"],
                update_columns=["aum", "nav", "listed_shares"],
            )
    return total


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed etf_universe from ETF_ALL.xlsx")
    parser.add_argument("--xlsx", type=Path, default=DEFAULT_XLSX)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--analyze-only", action="store_true")
    parser.add_argument("--report", type=Path, default=Path("data/xlsx_analysis.json"))
    args = parser.parse_args()

    if not args.xlsx.exists():
        raise FileNotFoundError(f"XLSX not found: {args.xlsx}")

    result = analyze_xlsx(args.xlsx)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(result["summary"], ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(result["summary"], ensure_ascii=False, indent=2))

    if args.analyze_only:
        return

    count = upsert_records(result["records"], dry_run=args.dry_run)
    print(f"Upserted {count} ETF universe rows")

    snapshot_date = datetime.now(timezone.utc).date().isoformat()
    meta_records = build_meta_records(args.xlsx, snapshot_date)
    meta_count = upsert_meta_records(meta_records, dry_run=args.dry_run)
    print(f"Upserted {meta_count} ETF meta rows (AUM/NAV snapshot {snapshot_date})")


if __name__ == "__main__":
    main()
