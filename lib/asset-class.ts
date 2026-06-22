import { isKrxListedStock } from "@/lib/stock-universe";
import { isOverseasListedBondName, OVERSEAS_LISTED_BOND_NAME_RE } from "@/lib/overseas-listed-bond";
import { isKrBankDiscountBond, isKrBankSerialBondName, KR_BANK_CD_RE } from "@/lib/kr-bank-bond";

export type AssetClassId =
  | "overseas_bond"
  | "gov_bond"
  | "fin_bond"
  | "corp_bond"
  | "monetary_bond"
  | "agency_bond"
  | "cp";

const LABELS: Record<AssetClassId, string> = {
  overseas_bond: "해외채",
  gov_bond: "국채",
  fin_bond: "금융채",
  corp_bond: "회사채",
  monetary_bond: "통안채",
  agency_bond: "공사채",
  cp: "CP",
};

/** 금융·지주 등 채권이 아닌 종목 */
const EQUITY_EXCLUDE_RE =
  /금융지주|금융지수|^KB금융$|^iM금융지주$|^JB금융지주$|^BNK금융지주$|^메리츠금융지주$|^우리금융지주$|^하나금융지주$|^한국금융지주$/;

const OVERSEAS_BOND_RE =
  /TREASURY|AGGREGATE\s+BOND|INTL\s+.*BOND|CORPORATE\s+BOND|GOVT\s+BOND|US\s+TIP|IBONDS|ZERO\s+CPN|^(?:T|SP|KOREAT|KORWAT|KOROIL)\s+\d[\d\s./%-]+\d{1,2}\/\d{1,2}\/\d{2,4}/i;

const GOV_BOND_RE =
  /국고채|물가연동국고|통화안정|\d+년\s*국채|\d+년국채|통안채|국채선물|KIS국고|국채액티브|국고채\d|^국고\d+-/i;

const FIN_BOND_RE = /금융채|농업금융채|금융채권|금융캐피탈|금융본부.*채/i;

const CORP_BOND_RE = /회사채|사채권|우량회사채/i;

const CP_RE =
  /\(CP\)|\(CP |CP\)|전자단기사채|단기사채|\(CD\)|\(CD |CD\)|\bCD\b|양도성예금|예금증서|\(단\)|\(할\)/i;

/** 증권사 발행 단기어음·CP (예: 현대차증권 20260605-18-7(단), 유진투자증권 20250717-344-2) */
const SECURITIES_SHORT_TERM_RE =
  /(?:증권|투자증권|금융투자)\s*\d{8}-\d+-\d+(?:\((?:단|할)\))?|\d{8}-\d+-\d+\((?:단|할)\)/;

const SWAP_DERIV_RE = /스왑|SWAP|TRS|총수익/i;

const FUTURES_RE = /국채\s*F\s*\d|\d+년\s*국채\s*F|국채선물|\sF\s+\d{6}\s*$|TOP\s+\d+\s+F\s+\d{6}/i;

const LISTED_BOND_ETF_RE =
  /^(KODEX|TIGER|ARIRANG|RISE|SOL|ACE|HANARO|PLUS|1Q|KOSEF)\b.*(채|국고|머니|MMF|CD|금융채|회사채|통안)/i;

const AGENCY_BOND_RE =
  /토지주택채|전력공사채|주택금융|공사채|인프라.*채|도시개발채|철도공사|전력공사|인천공항|한국가스|도로공사|공사\d/i;

/** KRX 상장 카드사 주식 (029780 삼성카드 등) — 발행채(삼성카드2826)와 구분 */
const LISTED_CARD_EQUITY_RE = /^(삼성카드|국민카드|신한카드|우리카드|하나카드|현대카드|BC카드)$/;

/** 카드사 발행 금융채 일련번호 (삼성카드2826, 카드123-1 등) */
const FIN_CARD_BOND_RE = /(?:국민|신한|우리|하나|삼성|현대|BC|NH|농협)?카드\d/i;

/** 증권·카드사 발행 사채 (미래증권17-1, 메리츠증권605-1 등) */
const SECURITIES_SERIAL_RE = /(?:증권|금융투자|커머스|카드)\d/i;

const BOND_CODE_RE = /채권\d{3,}|\(\d{2}-\d+\)\s*$|\d{8}-\d+-\d+\((?:단|할)\)|(?:^|\s)\d+-\d+\s*$/;

const OVERSEAS_BOND_ETF_KEYWORD_RE =
  /BOND|DEBT|FIXED\s*INCOME|CREDIT|TREASURY|GOVT|TIPS|AGGREGATE|CORPORATE|MORTGAGE|MBS|HIGH\s*YIELD|INVESTMENT\s*GRADE|IBOX|LQD|\bBND\b|\bHYG\b|\bMBB\b/i;

const OVERSEAS_EQUITY_ETF_KEYWORD_RE =
  /STOCK|EQUITY|S&P|SP\s*500|NASDAQ|MSCI|WORLD|TOTAL\s*STOCK|ACWI|RUSSELL|FTSE|GROWTH|VALUE|DIVIDEND|SEMICONDUCTOR|SMALL\s*CAP|MID\s*CAP|LARGE\s*CAP|SECTOR|DEVELOPED|EMERGING\s*MARKET|DOW\s*JONES|NIKKEI|HANG\s*SENG|TECHNOLOGY|HEALTH\s*CARE|ENERGY|INDUSTRIAL|REAL\s*ESTATE|CONSUMER|\bVOO\b|\bVTI\b|\bVT\b|\bQQQ\b|\bSPY\b|\bIVV\b/i;

const OVERSEAS_ETF_ISSUER_RE =
  /^(?:ISHARES|VANGUARD|SPDR|WISDOMTREE|INVESCO|JPMORGAN|BLACKROCK|STATE\s*STREET|PROSHARES|FIRST\s*TRUST|GLOBAL\s*X|FRANKLIN)/i;

/** Vanguard S&P 500 ETF 등 해외 주식형 ETF */
export function isOverseasEquityEtfName(name: string): boolean {
  const trimmed = name.trim();
  const upper = trimmed.toUpperCase();
  if (!/\bETF\b/.test(upper) && !OVERSEAS_ETF_ISSUER_RE.test(trimmed)) return false;
  if (OVERSEAS_BOND_ETF_KEYWORD_RE.test(upper)) return false;
  if (OVERSEAS_EQUITY_ETF_KEYWORD_RE.test(upper)) return true;
  if (/\bETF\s*$/.test(upper) && OVERSEAS_ETF_ISSUER_RE.test(trimmed)) return true;
  return false;
}

export function isOverseasBondEtfByName(name: string): boolean {
  const upper = name.trim().toUpperCase();
  if (isOverseasEquityEtfName(name)) return false;
  if (!/\bETF\b/.test(upper)) return false;
  return OVERSEAS_BOND_ETF_KEYWORD_RE.test(upper);
}

function isOverseasEquityByName(name: string): boolean {
  if (/[\uAC00-\uD7A3]/.test(name)) return false;
  const upper = name.toUpperCase();
  if (OVERSEAS_BOND_RE.test(upper) || /해외.*채/.test(name)) return false;
  if (isOverseasListedBondName(name)) return false;
  if (/\bTRS\b/.test(upper)) return false;
  if (/\bETF\s*$/i.test(name.trim())) return isOverseasEquityEtfName(name);
  if (SWAP_DERIV_RE.test(name)) return false;
  if (FUTURES_RE.test(name)) return false;
  return /[A-Z]{4,}/.test(name);
}

function isLikelyEquity(name: string, stockCode?: string | null): boolean {
  if (EQUITY_EXCLUDE_RE.test(name)) return true;
  const code = (stockCode ?? "").trim();
  if (LISTED_CARD_EQUITY_RE.test(name.trim()) && isKrxListedStock(code)) return true;

  if (isOverseasEquityByName(name)) return true;

  return false;
}

function inferListedBondEtfClass(name: string): AssetClassId | null {
  if (!LISTED_BOND_ETF_RE.test(name)) return null;
  if (/회사채|우량회사|크레딧|종합채권/.test(name)) return "corp_bond";
  if (/국고|국채|선물|통안|물가연동/.test(name)) return "gov_bond";
  if (/단기채권|초단기채권/.test(name)) return "gov_bond";
  if (/단기사채|머니마켓|전단/.test(name)) return "cp";
  if (/CD|CP/.test(name) && !/채권/.test(name)) return "cp";
  if (/금융채/.test(name)) return "fin_bond";
  if (/공사|인프라/.test(name)) return "agency_bond";
  if (/채권|채/.test(name)) return "corp_bond";
  return "fin_bond";
}

export function inferAssetClass(
  stockName?: string | null,
  stockCode?: string | null,
): AssetClassId | null {
  const name = (stockName || "").trim();
  if (!name) return null;

  const upper = name.toUpperCase();

  if (/\bTRS\b/.test(upper) || /INDEX\s+TR/i.test(upper)) return "corp_bond";
  if (SWAP_DERIV_RE.test(name)) return "corp_bond";
  if (FUTURES_RE.test(name)) return "gov_bond";
  if (OVERSEAS_LISTED_BOND_NAME_RE.test(name)) return "overseas_bond";
  if (isOverseasBondEtfByName(name)) return "overseas_bond";
  if (/전단채|단기채플러스|머니마켓/i.test(name)) return "gov_bond";
  if (KR_BANK_CD_RE.test(name)) return "cp";
  if (isKrBankSerialBondName(name)) {
    return isKrBankDiscountBond(name) ? "cp" : "fin_bond";
  }

  if (isLikelyEquity(name, stockCode)) return null;

  if (/해외.*채/.test(name) || OVERSEAS_BOND_RE.test(upper)) return "overseas_bond";

  if (GOV_BOND_RE.test(name) || FUTURES_RE.test(name)) return "gov_bond";

  if (FIN_BOND_RE.test(name) && !/금융지주/.test(name)) return "fin_bond";
  if (/캐피탈\d/.test(name)) return "fin_bond";
  if (FIN_CARD_BOND_RE.test(name)) return "fin_bond";
  const listedBondEtfClass = inferListedBondEtfClass(name);
  if (listedBondEtfClass) return listedBondEtfClass;

  if (CP_RE.test(name) || SECURITIES_SHORT_TERM_RE.test(name)) return "cp";

  if (SWAP_DERIV_RE.test(name)) return "corp_bond";

  if (CORP_BOND_RE.test(name)) return "corp_bond";

  if (SECURITIES_SERIAL_RE.test(name)) return "corp_bond";

  if (AGENCY_BOND_RE.test(name)) return "agency_bond";

  if (BOND_CODE_RE.test(name)) {
    if (/국고|국채|통안|통화안정/.test(name)) return "gov_bond";
    if (/공사|철도|전력|LH|주택/i.test(name)) return "agency_bond";
    if (/캐피탈|카드|금융/i.test(name)) return "fin_bond";
    return "corp_bond";
  }

  if (/\d{8}-\d+-\d+/.test(name) && /캐피탈|증권|금융|투자/i.test(name)) return "cp";

  if (/공사\d/.test(name)) return "agency_bond";
  if (/카드\d+-\d+/.test(name)) return "fin_bond";

  return null;
}

export function assetClassLabel(id: AssetClassId): string {
  return LABELS[id];
}

export function assetClassTone(id: AssetClassId): string {
  switch (id) {
    case "overseas_bond":
      return "asset-class-tag--overseas";
    case "gov_bond":
      return "asset-class-tag--gov";
    case "fin_bond":
      return "asset-class-tag--fin";
    case "corp_bond":
      return "asset-class-tag--corp";
    case "monetary_bond":
      return "asset-class-tag--monetary";
    case "agency_bond":
      return "asset-class-tag--agency";
    case "cp":
      return "asset-class-tag--cp";
    default:
      return "";
  }
}
