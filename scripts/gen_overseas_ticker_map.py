"""Generate lib/overseas-ticker-map.ts from holdings_daily + logo files."""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env.local")

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
    "COHERENT": "COHR",
    "DARDEN": "DRI",
    "HOME DEPOT": "HD",
    "CROWDSTRIKE": "CRWD",
    "ELI LILLY": "LLY",
    "DATADOG": "DDOG",
    "EOG RESOUR": "EOG",
    "INTEL": "INTC",
    "PALO ALTO": "PANW",
    "CORNING": "GLW",
    "GILEAD": "GILD",
    "HERSHEY": "HSY",
    "LAM RESEARCH": "LRCX",
    "ALTRIA": "MO",
    "MONOLITHIC POWER": "MPWR",
    "ABBVIE": "ABBV",
    "CONOCOPHILLIPS": "COP",
    "NETFLIX": "NFLX",
    "META PLATFORMS": "META",
    "META": "META",
    "AMAZON": "AMZN",
    "JPMORGAN": "JPM",
    "BANK OF AMERICA": "BAC",
    "WALMART": "WMT",
    "DISNEY": "DIS",
    "NIKE": "NKE",
    "STARBUCKS": "SBUX",
    "PAYPAL": "PYPL",
    "SALESFORCE": "CRM",
    "ORACLE": "ORCL",
    "ADOBE": "ADBE",
    "QUALCOMM": "QCOM",
    "TEXAS INSTRUMENT": "TXN",
    "SERVICENOW": "NOW",
    "SNOWFLAKE": "SNOW",
    "UBER": "UBER",
    "AIRBNB": "ABNB",
    "BAIDU": "BIDU",
    "ASML": "ASML",
    "CLOUDFLARE": "NET",
    "GOLDMAN SACHS": "GS",
    "MORGAN STANLEY": "MS",
    "GENERAL MOTORS": "GM",
    "3M": "MMM",
    "PAYCHEX": "PAYX",
    "VISA": "V",
    "MARRIOTT": "MAR",
    "CONSTELLATION ENERGY": "CEG",
    "S&P GLOBAL": "SPGI",
    "DEVON ENERGY": "DVN",
    "FIFTH THIRD": "FITB",
    "SYNOPSYS": "SNPS",
    "UNITED PARCEL": "UPS",
    "TERADYNE": "TER",
    "MICROCHIP TECHNOLOGY": "MCHP",
    "MICRON TECHNOLOGY": "MU",
    "INTUIT": "INTU",
    "TAIWAN SEMICONDUCTOR": "TSM",
    "BRISTOL-MYERS": "BMY",
    "ONEOK": "OKE",
    "EXXON MOBIL": "XOM",
    "T-MOBILE": "TMUS",
    "KIMBERLY-CLARK": "KMB",
    "ROSS STORES": "ROST",
    "ROCKWELL AUTOMATION": "ROK",
    "T ROWE PRICE": "TROW",
    "CINCINNATI FINANCIAL": "CINF",
    "WELLS FARGO": "WFC",
    "CITIGROUP": "C",
    "COMCAST": "CMCSA",
    "PHILIP MORRIS": "PM",
    "LOCKHEED MARTIN": "LMT",
    "GENERAL DYNAMICS": "GD",
    "NORTHROP GRUMMAN": "NOC",
    "HOWMET AEROSPACE": "HWM",
    "HOWMET": "HWM",
    "RTX": "RTX",
    "RAYTHEON": "RTX",
    "RHEINMETALL": "RHM",
    "SANOFI": "SNY",
    "LEONARDO": "LDO",
    "SAAB": "SAABY",
    "BAE SYSTEMS": "BAESY",
    "BOEING": "BA",
    "SCHWAB": "SCHW",
    "CHARLES SCHWAB": "SCHW",
    "BLACKROCK": "BLK",
    "ACCENTURE": "ACN",
    "MCDONALD": "MCD",
    "LOWE": "LOW",
    "TARGET": "TGT",
    "DEERE": "DE",
    "UNION PACIFIC": "UNP",
    "NEXTERA": "NEE",
    "COLGATE": "CL",
    "MONDELEZ": "MDLZ",
    "GENERAL ELECTRIC": "GE",
    "STRYKER": "SYK",
    "MEDTRONIC": "MDT",
    "ABBOTT": "ABT",
    "THERMO FISHER": "TMO",
    "REGENERON": "REGN",
    "VERTEX": "VRTX",
    "MODERNA": "MRNA",
    "BOOKING HOLDINGS": "BKNG",
    "BOOKING": "BKNG",
    "SHOPIFY": "SHOP",
    "SPOTIFY": "SPOT",
    "WORKDAY": "WDAY",
    "ATLASSIAN": "TEAM",
    "AUTODESK": "ADSK",
    "ANALOG DEVICES": "ADI",
    "KLA": "KLAC",
    "CADENCE": "CDNS",
    "NXP": "NXPI",
    "ON SEMICONDUCTOR": "ON",
    "SEAGATE": "STX",
    "WESTERN DIGITAL": "WDC",
    "EATON": "ETN",
    "HONEYWELL": "HON",
    "ILLINOIS TOOL": "ITW",
    "SHERWIN": "SHW",
    "FREEPORT": "FCX",
    "NEWMONT": "NEM",
    "VALE": "VALE",
    "PETROBRAS": "PBR",
    "BP": "BP",
    "SHELL": "SHEL",
    "TOTALENERGIES": "TTE",
    "BERKSHIRE": "BRK.B",
    "CHIPOTLE": "CMG",
    "STANLEY BLACK": "SWK",
    "AMERICAN EXPRESS": "AXP",
    "AMERICAN TOWER": "AMT",
    "SIMON PROPERTY": "SPG",
    "PROLOGIS": "PLD",
    "CROWN CASTLE": "CCI",
    "REALTY INCOME": "O",
    "DOMINION ENERGY": "D",
    "SOUTHERN": "SO",
    "DUKE ENERGY": "DUK",
    "MONSTER BEVERAGE": "MNST",
    "AUTOMATIC DATA PROCESSING": "ADP",
    "LINDE": "LIN",
    "AIR PRODUCTS": "APD",
    "SCHLUMBERGER": "SLB",
    "HALLIBURTON": "HAL",
    "OCCIDENTAL": "OXY",
    "PIONEER": "PXD",
    "MARATHON PETROLEUM": "MPC",
    "PHILLIPS 66": "PSX",
    "VALERO": "VLO",
    "EOG": "EOG",
    "PINTEREST": "PINS",
    "SNAP": "SNAP",
    "TWITTER": "TWTR",
    "BLOCK INC": "SQ",
    "SQUARE": "SQ",
    "ROBINHOOD": "HOOD",
    "COINBASE": "COIN",
    "ROBLOX": "RBLX",
    "DELL": "DELL",
    "HP INC": "HPQ",
    "HEWLETT": "HPE",
    "LENOVO": "LNVGY",
    "SAP": "SAP",
    "SONY": "SONY",
    "TOYOTA": "TM",
    "HONDA": "HMC",
    "NISSAN": "NSANY",
    "BYD CO": "BYDDY",
    "CONTEMPORARY AMPEREX": "3750.HK",
    "AMPEREX TECHN": "3750.HK",
    "BOE TECHNOLOGY": "BOEAY",
    "ADIDAS": "ADDYY",
    "GUANGZHOU TINCI": "300405.SZ",
    "TINCI MATERIALS": "300405.SZ",
    "HUAYOU COBALT": "603799.SS",
    "ZHEJIANG HUAYOU": "603799.SS",
    "CHINA TOWER": "0788.HK",
    "CSI SOLAR": "688472.SS",
    "CANADIAN SOLAR": "CSIQ",
    "WUXI LEAD": "300450.SZ",
    "WUXI BIOLOGICS": "2269.HK",
    "UNITED NOVA": "688981.SS",
    "HENGRUI PHARMACEUT": "600276.SS",
    "HENGTONG OPTIC": "600487.SS",
    "JIANGSU HENGRUI": "600276.SS",
    # --- 추가 해외종목 (KRX ETF 보유명 기준) ---
    "PALANTIR": "PLTR",
    "VERISIGN": "VRSN",
    "LUMENTUM": "LITE",
    "VERTIV": "VRT",
    "ARM HOLDINGS": "ARM",
    "GE VERNOVA": "GEV",
    "APPLOVIN": "APP",
    "TAKE-TWO": "TTWO",
    "TAKE TWO": "TTWO",
    "FAIR ISAAC": "FICO",
    "SUPER MICRO": "SMCI",
    "MONGODB": "MDB",
    "ASTERA LABS": "ALAB",
    "CREDO TECHNOLOGY": "CRDO",
    "CREDO": "CRDO",
    "ROCKET LAB": "RKLB",
    "ALIBABA": "BABA",
    "TENCENT": "TCEHY",
    "KRAFT HEINZ": "KHC",
    "GENERAC": "GNRC",
    "INCYTE": "INCY",
    "INTERCONTINENTAL EXCHANGE": "ICE",
    "NASDAQ OMX": "NDAQ",
    "KINDER MORGAN": "KMI",
    "PFIZER": "PFE",
    "OREILLY": "ORLY",
    "ADVANCED MICRO DEVICES": "AMD",
    "VERTEX PHARM": "VRTX",
    "ARISTA NETWORKS": "ANET",
    "LULULEMON": "LULU",
    "ESTEE LAUDER": "EL",
    "US BANCORP": "USB",
    "ADVANTEST": "ATEYY",
    "ZIMMER": "ZBH",
    "TRADE DESK": "TTD",
    "NUCOR": "NUE",
    "CIRCLE INTERNET": "CRCL",
    "COREWEAVE": "CRWV",
    "DOORDASH": "DASH",
    "CARVANA": "CVNA",
    "EXPEDIA": "EXPE",
    "LIVE NATION": "LYV",
    "ZOETIS": "ZTS",
    "MOODYS": "MCO",
    "FORTIVE": "FTV",
    "WATSCO": "WSO",
    "QUANTA SERVICE": "PWR",
    "QUANTA SERVICES": "PWR",
    "SKYWORKS": "SWKS",
    "INTUITIVE SURGICAL": "ISRG",
    "ILLINOIS TOOL WORKS": "ITW",
    "CINTAS": "CTAS",
    "ROPER INDUSTRIES": "ROP",
    "ROPER TECHNOLOGIES": "ROP",
    "BTQ TECHNOLOGIES": "BTQ",
    "BTQ": "BTQ",
    "LOGITECH": "LOGI",
    "HILTON WORLDWIDE": "HLT",
    "DIAMONDBACK": "FANG",
    "EQT": "EQT",
    "ALBEMARLE": "ALB",
    "KEYSIGHT": "KEYS",
    "VENTAS": "VTR",
    "KROGER": "KR",
    "LULULEMON ATHLETICA": "LULU",
    "HCA HOLDINGS": "HCA",
    "WELLTOWER": "WELL",
    "INTERACTIVE BROKERS": "IBKR",
    "BOSTON SCIENTIFIC": "BSX",
    "GLOBAL PAYMENTS": "GPN",
    "L3HARRIS": "LHX",
    "BROWN & BROWN": "BRO",
    "CLOROX": "CLX",
    "CHURCH & DWIGHT": "CHD",
    "TRAVELERS": "TRV",
    "VEEVA SYSTEMS": "VEEV",
    "AT&T": "T",
    "AT&T INC": "T",
    "VANGUARD S&P": "VOO",
    "ISHARES CORE S&P": "IVV",
    "SPDR S&P": "SPY",
    "POWERSHARES QQQ": "QQQ",
    "ZHONGJI INNOLIGHT": "300308.SZ",
    "INNOLIGHT": "300308.SZ",
    "ZHEJIANG SHUANGHUAN": "002472.SZ",
    "CHANGSHENG BEARING": "300718.SZ",
    "YUNNAN ENERGY": "002812.SZ",
    "ZHEJIANG SANHUA": "002050.SZ",
    "ZHEJIANG SUPCON": "688777.SS",
    "SHANGHAI ILUVATAR": "688047.SS",
    "ASE TECHNOLOGY": "ASX",
    "YANDEX": "YNDX",
    "TRIP.COM": "TCOM",
    "YUM! BRANDS": "YUM",
    "YUM BRANDS": "YUM",
    "WW GRAINGER": "GWW",
    "XYLEM": "XYL",
    "POOL CORP": "POOL",
    "NRG ENERGY": "NRG",
    "PACKAGING CORP": "PKG",
    "IDEXX": "IDXX",
    "KIOXIA": "285A.T",
    "WEST PHARMA": "WST",
    "OTIS WORLDWIDE": "OTIS",
    "EDWARDS LIFESCIENCES": "EW",
    "NORFOLK SOUTHERN": "NSC",
    "AMERISAFE": "AMSF",
    "EQUINIX": "EQIX",
    "MCKESSON": "MCK",
    "GARMIN": "GRMN",
    "CONSTELLATION BRANDS": "STZ",
    "DECKERS OUTDOOR": "DECK",
    "INSULET": "PODD",
    "WABTEC": "WAB",
    "TYLER TECHNOLOGIES": "TYL",
    "FAIR ISAAC CORP": "FICO",
    "UNITED RENTALS": "URI",
    "AMETEK": "AME",
    "LEIDOS": "LDOS",
    "PTC INC": "PTC",
    "DEXCOM": "DXCM",
    "STEEL DYNAMICS": "STLD",
    "EXPEDITORS": "EXPD",
    "ARTHUR J GALLAGHER": "AJG",
    "COPART": "CPRT",
    "CENCORA": "COR",
    "DR HORTON": "DHI",
    "PULTEGROUP": "PHM",
    "CF INDUSTRIES": "CF",
    "J.B.HUNT": "JBHT",
    "EQUIFAX": "EFX",
    "CBOE GLOBAL": "CBOE",
    "WATERS CORPORATION": "WAT",
    "DOMINOS PIZZA": "DPZ",
    "LENNOX INTERNATIONAL": "LII",
    "CHARTER COMMUNICATIONS": "CHTR",
    "GENERAL MILLS": "GIS",
    "BROADRIDGE": "BR",
    "CME GROUP": "CME",
    "PRINCIPAL FINANCIAL": "PFG",
    "PARKER HANNIFIN": "PH",
    "PARKER-HANNIFIN": "PH",
    "TJX COMPAN": "TJX",
    "CUMMINS": "CMI",
    "BEST BUY": "BBY",
    "ARES MANAGEMENT": "ARES",
    "REGIONS FINANCIAL": "RF",
    "ARCHER-DANIELS": "ADM",
    "ARCHER DANIELS": "ADM",
    "FEDEX": "FDX",
    "FED EX": "FDX",
    "RESMED": "RMD",
    "DOVER": "DOV",
    "SYSCO": "SYY",
    "ECOLAB": "ECL",
    "WR BERKLEY": "WRB",
    "TAPESTRY": "TPR",
    "BUCKLE": "BKE",
    "MARSH & MCLENNAN": "MMC",
    "MARSH": "MMC",
    "PROGRESSIVE": "PGR",
    "KLA CORP": "KLAC",
    "AFLAC": "AFL",
    "ALLSTATE": "ALL",
    "DANAHER": "DHR",
    "AUTOLIV": "ALV",
    "AUTOZONE": "AZO",
    "HASBRO": "HAS",
    "STERIS": "STE",
    "MOELIS": "MC",
    "MCCORMICK": "MKC",
    "WATERS CORP": "WAT",
    "WATERS": "WAT",
    "PACCAR": "PCAR",
    "HUMANA": "HUM",
    "AMEREN": "AEE",
    "MACYS": "M",
    "3M CO": "MMM",
    "P G & E": "PCG",
    "EVERGY": "EVRG",
    "INTERPARFUMS": "IPAR",
    "NISOURCE": "NI",
    "SANDISK": "SNDK",
}

KRX_LISTED = set(json.loads((ROOT / "data" / "krx_listed_codes.json").read_text(encoding="utf-8"))["codes"])
US_TICKERS = set(json.loads((ROOT / "data" / "us_listed_tickers.json").read_text(encoding="utf-8"))["tickers"])

AMBIGUOUS_OVERSEAS_PROXY_RE = re.compile(r"^(0000\d{2}|1000\d{2})$")


def load_logos() -> set[str]:
    logos: set[str] = set()
    for path in (ROOT / "public" / "logos" / "stock").glob("*.svg"):
        stem = path.stem.upper()
        if stem.isascii():
            logos.add(stem)
    return logos


def ticker_in_logos(ticker: str, logos: set[str]) -> bool:
    if ".KQ" in ticker or ".KS" in ticker or ".HK" in ticker or ".SS" in ticker or ".SZ" in ticker:
        return False
    if ticker in logos:
        return True
    for suffix in (".O", ".N", ".A", ".K"):
        if f"{ticker}{suffix}" in logos:
            return True
    return False


def normalize_name(name: str) -> str:
    upper = re.sub(r"\s+", " ", name.upper().strip())
    upper = re.sub(r"\s*-\s*CL\s*[A-Z]\b", "", upper)
    upper = re.sub(r"\s*-\s*[A-Z]\b$", "", upper)
    upper = re.sub(
        r"\s*,?\s*(INCORPORATED|INC|CORP|CORPORATION|LTD|CO|PLC|NV|SA|AG|LP|LLC)\.?\s*(-|$)",
        " ",
        upper,
    )
    return re.sub(r"\s+", " ", upper).strip()


def logo_base_stems(logos: set[str]) -> list[str]:
    bases: set[str] = set()
    for stem in logos:
        base = re.sub(r"\.[A-Z]$", "", stem.upper())
        if re.fullmatch(r"[A-Z]{2,5}", base):
            bases.add(base)
    return sorted(bases, key=len, reverse=True)


def ticker_as_word_in_text(text: str, stem: str) -> bool:
    """티커 stem이 단어 경계로만 등장하는지 — TECHNOLOGIES 안의 LOGI 오매칭 방지."""
    if len(stem) >= 6:
        return stem in text
    return bool(re.search(rf"(?:^|[\s/(]){re.escape(stem)}(?:[\s/.,)]|$)", text))


def match_stem_in_name(upper: str, logos: set[str]) -> str | None:
    for base in logo_base_stems(logos):
        if len(base) < 3:
            continue
        if not ticker_in_logos(base, logos):
            continue
        if ticker_as_word_in_text(upper, base):
            return base
    return None


def ticker_resolvable(ticker: str, logos: set[str]) -> bool:
    return ticker_in_logos(ticker, logos) or ticker in US_TICKERS


def resolve_ticker(name: str | None, logos: set[str], fragments: dict[str, str]) -> str | None:
    if not name:
        return None
    upper = normalize_name(name)
    for fragment, ticker in sorted(fragments.items(), key=lambda item: -len(item[0])):
        if (
            len(fragment) >= 4
            and ticker_as_word_in_text(upper, fragment)
            and ticker_resolvable(ticker, logos)
        ):
            return ticker
    stem = match_stem_in_name(upper, logos)
    if stem:
        return stem
    if re.fullmatch(r"[A-Z]{1,5}", upper) and ticker_in_logos(upper, logos):
        return upper
    return None


def discover_fragments(rows, logos: set[str], existing: dict[str, str], min_count: int = 80) -> dict[str, str]:
    """보유 빈도 높은 미매핑 종목 → 로고 stem 기반 fragment 자동 추가."""
    additions: dict[str, str] = {}
    stems = logo_base_stems(logos)
    for code, name, count in rows:
        if count < min_count:
            continue
        if AMBIGUOUS_OVERSEAS_PROXY_RE.match(code):
            continue
        if code in KRX_LISTED:
            continue
        if resolve_ticker(name, logos, {**existing, **additions}):
            continue
        upper = normalize_name(name)
        for base in stems:
            if len(base) < 4 or base in additions or base in existing:
                continue
            if ticker_as_word_in_text(upper, base) and ticker_in_logos(base, logos):
                additions[base] = base
                break
        tokens = [t for t in upper.split() if len(t) >= 3][:3]
        if len(tokens) >= 2:
            phrase = " ".join(tokens[:2])
            if len(phrase) >= 8 and phrase not in existing and phrase not in additions:
                for base in stems:
                    if ticker_as_word_in_text(phrase, base) and ticker_in_logos(base, logos):
                        additions[phrase] = base
                        break
    return additions


SKIP_FRAGMENT_RE = re.compile(
    r"[\uac00-\ud7a3]|KODEX|TIGER|RISE|ARIRANG|HANARO|SOL\b|ACE\b|PLUS\b|1Q\b|KOSEF|채권|국고|회사채|금융채|CLASS\b",
    re.I,
)


def clean_fragments(fragments: dict[str, str], logos: set[str]) -> dict[str, str]:
    cleaned: dict[str, str] = {}
    for key, ticker in fragments.items():
        if SKIP_FRAGMENT_RE.search(key):
            continue
        if ticker.endswith((".KQ", ".KS")):
            continue
        if key.endswith("PIZZA") and ticker == "PI":
            continue
        if len(ticker) < 3:
            continue
        # LOGI처럼 다른 단어 안에 들어가는 짧은 티커 키는 fragment로 쓰지 않음
        if re.fullmatch(r"[A-Z]{2,5}", key) and key == ticker:
            continue
        if not ticker_resolvable(ticker, logos):
            continue
        cleaned[key] = ticker
    return cleaned


def main() -> None:
    import psycopg

    logos = load_logos()
    url = os.environ.get("DATABASE_URL")
    code_tickers: dict[str, set[str]] = {}
    discovered: dict[str, str] = {}
    all_fragments = NAME_FRAGMENTS

    if url:
        with psycopg.connect(url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT stock_code, stock_name, COUNT(*) AS c
                    FROM holdings_daily
                    WHERE stock_name ~ '[A-Z]{3,}'
                    GROUP BY stock_code, stock_name
                    ORDER BY c DESC
                    """
                )
                rows = cur.fetchall()
        discovered = discover_fragments(rows, logos, NAME_FRAGMENTS)
        all_fragments = {**NAME_FRAGMENTS, **discovered}
        for code, name, _count in rows:
            if AMBIGUOUS_OVERSEAS_PROXY_RE.match(code):
                continue
            if code in KRX_LISTED:
                continue
            if re.search(r"[\uac00-\ud7a3]", name or ""):
                continue
            if re.match(
                r"^(KODEX|TIGER|RISE|ARIRANG|HANARO|SOL|ACE|PLUS|1Q|KOSEF|TIMEFOLIO|WON|KIWOOM)\b",
                name or "",
                re.I,
            ):
                continue
            ticker = resolve_ticker(name, logos, all_fragments)
            if not ticker:
                continue
            code_tickers.setdefault(code, set()).add(ticker)

        all_fragments = clean_fragments({**NAME_FRAGMENTS, **discovered}, logos)
    else:
        all_fragments = clean_fragments(NAME_FRAGMENTS, logos)

    code_map = {
        code: next(iter(tickers))
        for code, tickers in code_tickers.items()
        if len(tickers) == 1 and ticker_resolvable(next(iter(tickers)), logos)
    }

    out = ROOT / "lib" / "overseas-ticker-map.ts"
    data_dir = ROOT / "scripts" / ".data"
    data_dir.mkdir(parents=True, exist_ok=True)
    json_path = data_dir / "krx_overseas_tickers.json"
    json_path.write_text(json.dumps(code_map, indent=2, ensure_ascii=False), encoding="utf-8")
    fragments_json = json.dumps(all_fragments, indent=2, ensure_ascii=False)
    codes_json = json.dumps(code_map, indent=2, ensure_ascii=False)
    out.write_text(
        f"""// Auto-generated by scripts/gen_overseas_ticker_map.py — do not edit by hand.

export const OVERSEAS_NAME_FRAGMENTS: Record<string, string> = {fragments_json};

/** KRX 해외종목 단축코드(6자리) → 로고 티커 */
export const KRX_OVERSEAS_CODE_TICKERS: Record<string, string> = {codes_json};
""",
        encoding="utf-8",
    )
    print(f"Wrote {out} ({len(code_map)} KRX codes, {len(all_fragments)} name fragments, +{len(discovered)} auto)")


if __name__ == "__main__":
    main()
