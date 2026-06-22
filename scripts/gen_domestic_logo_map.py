"""Generate data/domestic_code_logos.json and data/stock_logo_stems.json."""

from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env.local")

LOGO_DIR = ROOT / "public" / "logos" / "stock"
KRX_CODES = set(json.loads((ROOT / "data" / "krx_listed_codes.json").read_text(encoding="utf-8"))["codes"])
US_TICKERS = set(json.loads((ROOT / "data" / "us_listed_tickers.json").read_text(encoding="utf-8"))["tickers"])
AMBIGUOUS = re.compile(r"^(0000\d{2}|1000\d{2})$")


def normalize_label(value: str) -> str:
    s = value.strip().upper()
    s = s.replace("&AMP;", "&").replace("&", "&")
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\.$", "", s)
    return s


def is_us_ticker_stem(stem: str) -> bool:
    base = re.sub(r"\.[A-Z]$", "", stem.upper())
    if not re.fullmatch(r"[A-Z]{1,5}", base):
        return False
    return base in US_TICKERS


def load_logos() -> tuple[set[str], set[str], set[str], dict[str, str], dict[str, str]]:
    ascii_stems: set[str] = set()
    korean: set[str] = set()
    domestic_ascii: set[str] = set()
    code_named: dict[str, str] = {}
    norm_to_stem: dict[str, str] = {}

    for p in LOGO_DIR.glob("*.svg"):
        stem = p.stem
        norm_to_stem[normalize_label(stem.replace("&amp;", "&"))] = stem

        if re.fullmatch(r"\d{6}", stem):
            code_named[stem] = stem
        elif stem.isascii():
            upper = stem.upper()
            ascii_stems.add(upper)
            base = re.sub(r"\.[A-Z]$", "", upper)
            if base:
                ascii_stems.add(base)
            m = re.match(r"^(.+)_(\d{6})$", stem)
            if m:
                code_named[m.group(2)] = stem
            if (
                not is_us_ticker_stem(stem)
                or " " in stem
                or "&" in stem
                or re.search(r"[\uac00-\ud7a3]", stem)
            ):
                domestic_ascii.add(stem)
        else:
            korean.add(stem)

    return ascii_stems, korean, domestic_ascii, code_named, norm_to_stem


def pick_domestic_name(names: Counter[str]) -> str | None:
    hangul = [(n, c) for n, c in names.items() if re.search(r"[\uac00-\ud7a3]", n)]
    if hangul:
        hangul.sort(key=lambda x: x[1], reverse=True)
        return hangul[0][0]
    latin = [(n, c) for n, c in names.items() if n.strip()]
    if latin:
        latin.sort(key=lambda x: x[1], reverse=True)
        return latin[0][0]
    return None


def match_name_to_logo(
    name: str,
    korean_logos: set[str],
    domestic_ascii: set[str],
    norm_to_stem: dict[str, str],
) -> str | None:
    if not name:
        return None

    norm = normalize_label(name.replace("&amp;", "&"))
    if norm in norm_to_stem:
        return norm_to_stem[norm]

    if name in korean_logos:
        return name

    for logo in korean_logos:
        if len(logo) >= 3 and (logo in name or name in logo):
            return logo

    for logo in domestic_ascii:
        if normalize_label(logo.replace("&amp;", "&")) == norm:
            return logo
        if len(logo) >= 4 and (logo.upper() in name.upper() or name.upper() in logo.upper()):
            return logo

    return None


def main() -> None:
    from db_client import fetch_all, get_connection

    ascii_stems, korean_logos, domestic_ascii, code_named, norm_to_stem = load_logos()
    code_to_logo: dict[str, str] = dict(code_named)
    name_aliases: dict[str, str] = {}

    with get_connection() as conn:
        rows = fetch_all(
            conn,
            """
            SELECT stock_code, stock_name, COUNT(*)::int AS c
            FROM holdings_daily
            WHERE stock_code ~ '^[0-9]{6}$'
            GROUP BY stock_code, stock_name
            """,
        )

    by_code: dict[str, Counter[str]] = defaultdict(Counter)
    for row in rows:
        by_code[row["stock_code"]][row["stock_name"] or ""] += row["c"]

    for code, names in by_code.items():
        if code in code_to_logo:
            continue
        if code not in KRX_CODES or AMBIGUOUS.match(code):
            continue
        matched = None
        best_name = None
        for name, _count in names.most_common():
            if not name.strip():
                continue
            candidate = match_name_to_logo(name, korean_logos, domestic_ascii, norm_to_stem)
            if candidate:
                matched = candidate
                best_name = name
                break
        if matched:
            code_to_logo[code] = matched
            if best_name and best_name != matched:
                name_aliases[best_name] = matched

    overrides = {
        "033780": "KT&G",
        "030200": "KT_030200",
        "078930": "GS_078930",
        "036570": "엔씨소프트",
        "010120": "LS ELECTRIC",
        "035900": "JYP Ent",
        "383220": "F&amp;F",
        "035420": "NAVER",
        "267270": "HD현대건설기계",
    }
    for code, logo in overrides.items():
        if (LOGO_DIR / f"{logo}.svg").exists():
            code_to_logo[code] = logo

    out_domestic = ROOT / "data" / "domestic_code_logos.json"
    out_stems = ROOT / "data" / "stock_logo_stems.json"
    out_domestic.write_text(
        json.dumps(
            {"updated": "auto", "codes": code_to_logo, "name_aliases": name_aliases},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    out_stems.write_text(
        json.dumps(
            {
                "updated": "auto",
                "ascii": sorted(ascii_stems),
                "korean": sorted(korean_logos),
                "domestic_ascii": sorted(domestic_ascii),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"domestic_code_logos: {len(code_to_logo)} codes")
    print(f"ascii stems: {len(ascii_stems)}, korean: {len(korean_logos)}, domestic_ascii: {len(domestic_ascii)}")


if __name__ == "__main__":
    main()
