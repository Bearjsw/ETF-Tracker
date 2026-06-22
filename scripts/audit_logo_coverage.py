"""Audit stock logo mapping coverage for holdings_daily names."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env.local")

LOGO_DIR = ROOT / "public" / "logos" / "stock"
KRX_CODES = set(json.loads((ROOT / "data" / "krx_listed_codes.json").read_text(encoding="utf-8"))["codes"])
DOMESTIC = json.loads((ROOT / "data" / "domestic_code_logos.json").read_text(encoding="utf-8"))["codes"]


def load_logo_stems() -> set[str]:
    return {p.stem for p in LOGO_DIR.glob("*.svg")}


def normalize_name(name: str) -> str:
    s = name.strip().upper()
    s = s.replace("&", "&AMP;").replace("'", "")
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\.$", "", s)
    return s


def normalize_stem(stem: str) -> str:
    return normalize_name(stem.replace("&amp;", "&AMP;"))


def load_overseas_fragments() -> tuple[dict[str, str], dict[str, str]]:
    json_path = ROOT / "scripts" / ".data" / "krx_overseas_tickers.json"
    code_map = json.loads(json_path.read_text(encoding="utf-8")) if json_path.exists() else {}
    text = (ROOT / "lib" / "overseas-ticker-map.ts").read_text(encoding="utf-8")
    start = text.index("OVERSEAS_NAME_FRAGMENTS")
    start = text.index("{", start)
    depth = 0
    end = start
    for i, ch in enumerate(text[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    blob = text[start:end]
    frag_map: dict[str, str] = {}
    namespace: dict[str, object] = {}
    exec(f"frag_map = {blob}", namespace)  # noqa: S102
    frag_map = namespace.get("frag_map", {})
    if not isinstance(frag_map, dict):
        frag_map = {}
    return frag_map, code_map


def resolve_ticker(name: str | None, code: str, frag_map: dict[str, str], code_map: dict[str, str]) -> str | None:
    if not name:
        return code_map.get(code)
    upper = normalize_name(name)
    if re.fullmatch(r"[A-Z]{1,5}", upper.replace(".", "")):
        return upper.replace(".", "")
    for frag, tick in sorted(frag_map.items(), key=lambda x: -len(x[0])):
        if len(frag) >= 4 and normalize_name(frag) in upper:
            return tick
    return code_map.get(code)


def has_logo(name: str | None, code: str, ticker: str | None, stems: set[str]) -> bool:
    if code in DOMESTIC and (LOGO_DIR / f"{DOMESTIC[code]}.svg").exists():
        return True
    if code in stems:
        return True
    if name and name in stems:
        return True
    if name:
        norm = normalize_name(name)
        for stem in stems:
            if normalize_stem(stem) == norm:
                return True
        for stem in stems:
            if len(stem) >= 4 and (stem.upper() in name.upper() or name.upper() in stem.upper()):
                return True
    if ticker:
        t = ticker.upper()
        if t in {s.upper() for s in stems}:
            return True
        if f"{t}_{t}" in {s.upper() for s in stems}:
            return True
        for suf in (".O", ".N", ".A", ".K"):
            if f"{t}{suf}" in {s.upper() for s in stems}:
                return True
            if f"{t}_{t}{suf}" in {s.upper() for s in stems}:
                return True
    return False


def main() -> None:
    from db_client import fetch_all, get_connection

    stems = load_logo_stems()
    frag_map, code_map = load_overseas_fragments()

    with get_connection() as conn:
        rows = fetch_all(
            conn,
            """
            SELECT stock_code, stock_name, COUNT(*)::int AS c
            FROM holdings_daily
            GROUP BY stock_code, stock_name
            ORDER BY c DESC
            LIMIT 800
            """,
        )

    missing = []
    for row in rows:
        code = row["stock_code"]
        name = row["stock_name"]
        ticker = resolve_ticker(name, code, frag_map, code_map)
        if not has_logo(name, code, ticker, stems):
            missing.append((row["c"], code, name, ticker))

    print(f"Top holdings checked: {len(rows)}")
    print(f"Missing logo: {len(missing)}")
    for c, code, name, ticker in missing[:50]:
        print(f"  {c:5d}  {code}  {name!r}  ticker={ticker}")


if __name__ == "__main__":
    main()
