import { inferAssetClass, isOverseasEquityEtfName, type AssetClassId } from "@/lib/asset-class";
import { extractBondIssuerShortName, formatBondIssuerDisplayName } from "@/lib/bond-issuer";
import {
  isKrBankDiscountBond,
  isKrBankSerialBondName,
  KR_BANK_CD_RE,
  parseKrBankBondYymm,
  extractKrBankBondIssuer,
} from "@/lib/kr-bank-bond";
import { isOverseasListedBondName } from "@/lib/overseas-listed-bond";

const MAX_LABEL_LEN = 12;
/** 국내 채권 ETF — 브랜드+상품 유형 구분을 위해 여유 있게 */
const ETF_LABEL_LEN = 24;
/** 통안채·공사채·CP 등 일련번호가 있는 개별 채권 */
const PRESERVED_BOND_MAX_LEN = 48;

/** KRX 원문 종목명 유지 (자금부·국고채권·CP 일련번호 등) */
export function shouldPreserveBondDisplayName(name?: string | null): boolean {
  const trimmed = name?.trim();
  if (!trimmed || trimmed.length > PRESERVED_BOND_MAX_LEN) return false;

  if (/^[\uAC00-\uD7A3A-Za-z0-9]+(?:공사|전력|가스|철도|도로|항공|마사|개발|금융)?채권\d+$/.test(trimmed)) {
    return true;
  }
  if (/^[\uAC00-\uD7A3]+금융채권/.test(trimmed)) return true;
  if (/[\uAC00-\uD7A3].*\d{8}-\d+-\d+\((?:단|할)\)/.test(trimmed)) return true;
  if (/^국고\d+-/.test(trimmed) || /^국고채권\d+/.test(trimmed)) return true;
  if (/^물가연동국고/.test(trimmed)) return true;
  if (/^국고채(?:이자|원금)?분리/.test(trimmed)) return true;
  if (/^[\uAC00-\uD7A3]+(?:\s+[\uAC00-\uD7A3]+)?\s+자금부\s+\d{8}/.test(trimmed)) return true;
  if (/^[\uAC00-\uD7A3]+(?:은행|증권|금융투자)?\s+RP\s+\d{8}/i.test(trimmed)) return true;
  if (/^[\uAC00-\uD7A3]/.test(trimmed) && /\d{8}-\d+-\d+/.test(trimmed)) return true;

  return false;
}

/** @deprecated shouldPreserveBondDisplayName 사용 */
export function isPreservedSerialBondName(name?: string | null): boolean {
  return shouldPreserveBondDisplayName(name);
}

const DOMESTIC_BOND_ETF_BRANDS =
  "KODEX|TIGER|ARIRANG|RISE|SOL|ACE|HANARO|PLUS|1Q|KOSEF|KIWOOM|WON|TIMEFOLIO|KOACT";

const DOMESTIC_ETF_BRAND_RE = new RegExp(`^(${DOMESTIC_BOND_ETF_BRANDS})\\b`, "i");

const DOMESTIC_BOND_ETF_RE = new RegExp(`^(${DOMESTIC_BOND_ETF_BRANDS})\\s+(.+)$`, "i");

const DOMESTIC_BOND_ETF_REST_RE =
  /채|국고|국채|머니|MMF|CD|금융|회사|통안|선물|액티브|단기/i;

export function isDomesticBondEtfName(name?: string | null): boolean {
  const m = name?.trim().match(DOMESTIC_BOND_ETF_RE);
  if (!m) return false;
  return DOMESTIC_BOND_ETF_REST_RE.test(m[2]);
}

function extractCreditGrade(rest: string): string | null {
  return rest.match(/\(([A-Z0-9+-]+(?:이상)?)\)/)?.[1] ?? null;
}

/** KODEX 26-12 금융채… → 26-12 (만기 시리즈) */
function extractSeriesMaturity(rest: string): string | null {
  return rest.match(/^(\d{2}-\d{2})\b/)?.[1] ?? null;
}

function withGrade(base: string, grade: string | null): string {
  return grade ? `${base}(${grade})` : base;
}

export type BondDisplayResult = {
  display: string;
  original: string;
  /** 단순화된 표시명이면 true — 툴팁에 original 노출 */
  simplified: boolean;
};

function trimLabel(text: string, max = MAX_LABEL_LEN): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1)}…`;
}

function parseMaturityYearFromDate(name: string): number | null {
  const matches = [...name.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g)];
  const m = matches.at(-1);
  if (!m) return null;
  const y = Number(m[3]);
  if (y >= 1000) return y;
  return y >= 50 ? 1900 + y : 2000 + y;
}

function maturityYearSuffix(fullYear: number): string {
  return String(fullYear % 100).padStart(2, "0");
}

/** T 4 5/8 05/15/54 — 미국 국채만 (KOREAT·KOROIL 등 한국 발행 해외상장채 제외) */
function formatUsTreasury(name: string): string | null {
  const trimmed = name.trim();
  if (!/^(?:T|SP)\s+[\d\s./%-]+\d{1,2}\/\d{1,2}\/\d{2,4}/i.test(trimmed)) return null;

  const year = parseMaturityYearFromDate(trimmed);
  if (!year) return trimLabel("미국 국채");

  return trimLabel(`미국 국채 ${maturityYearSuffix(year)}년 만기`);
}

/** KOREAT 4 1/8 02/02/28, KOROIL 3 3/8 03/27/27 — 한국 발행 해외상장채 */
function formatKoreanOverseasListedBond(name: string): string | null {
  const m = name.trim().match(/^(KOREAT|KORWAT|KOROIL)\s+/i);
  if (!m) return null;

  const year = parseMaturityYearFromDate(name);
  const yearLabel = year ? `${maturityYearSuffix(year)}년` : null;

  if (/^KOROIL/i.test(m[1])) {
    return trimLabel(yearLabel ? `한국석유 회사채 ${yearLabel}` : "한국석유 회사채", ETF_LABEL_LEN);
  }

  return trimLabel(yearLabel ? `한국 국채 ${yearLabel} 만기` : "한국 국채", ETF_LABEL_LEN);
}

/** WMT 4.35 04/28/30, LMT 4.15 06/15/53 */
function formatUsCorporateBond(name: string): string | null {
  const m = name.match(/^([A-Z]{1,5})\s+[\d.]+\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/i);
  if (!m) return null;
  const year = parseMaturityYearFromDate(name);
  if (!year) return trimLabel("미국회사채");
  return trimLabel(`미국회사채${maturityYearSuffix(year)}년`);
}

/** 중소기업은행(신)2505할1A-28, 국민은행(CD) */
function formatKrBankSerialBond(name: string): string | null {
  if (KR_BANK_CD_RE.test(name)) {
    const issuer = extractKrBankBondIssuer(name);
    if (!issuer) return trimLabel("CD");
    return trimLabel(`${formatBondIssuerDisplayName(issuer)} CD`, ETF_LABEL_LEN);
  }

  if (!isKrBankSerialBondName(name)) return null;

  const issuerRaw = extractKrBankBondIssuer(name);
  if (!issuerRaw) return null;

  const issuer = formatBondIssuerDisplayName(issuerRaw);
  const yymm = parseKrBankBondYymm(name);

  if (isKrBankDiscountBond(name)) {
    return trimLabel(yymm ? `${issuer} ${yymm} CP` : `${issuer} CP`, ETF_LABEL_LEN);
  }

  return trimLabel(yymm ? `${issuer} ${yymm} 금융채` : `${issuer} 금융채`, ETF_LABEL_LEN);
}

/** 통화안정증권02280-2607-01 → 통안채 26.07 */
function formatMonetaryStabilizationBond(name: string): string | null {
  const trimmed = name.trim();
  const serial = trimmed.match(/^통화안정증권\d+-(\d{2})(\d{2})-\d+/);
  if (serial) return trimLabel(`통안채 ${serial[1]}.${serial[2]}`);
  if (/^통화안정증권/.test(trimmed)) return trimLabel("통안채");
  return null;
}

/** 신한 자금부 20260219-365-1, KB은행 RP 20260219-1-1 등 — 원문은 shouldPreserveBondDisplayName에서 유지 */
function formatKrMoneyMarketInstrument(name: string): string | null {
  const trimmed = name.trim();

  const rp = trimmed.match(/^([\uAC00-\uD7A3]+(?:은행|증권|금융투자)?)\s+RP(?:\s+\d{8}-\d+-\d+.*)?$/i);
  if (rp && !/\d{8}-\d+-\d+/.test(trimmed)) {
    return trimLabel(`${formatBondIssuerDisplayName(rp[1])} RP`);
  }

  return null;
}

/** 국고채권03875-2612(23-10), 물가연동국고…(18-5), 국고02500-3009 */
function formatKrGovBond(name: string): string | null {
  const monetary = formatMonetaryStabilizationBond(name);
  if (monetary) return monetary;

  if (isDomesticBondEtfName(name)) return null;
  const coded = name.match(/^국고\d+-(\d{2})\d{2}$/);
  if (coded) return trimLabel(`국고채 ${coded[1]}년 만기`);

  const tenor = name.match(/(?:국고채|KIS국고채|국채)(\d+)년/i);
  if (tenor) return trimLabel(`국고채 ${tenor[1]}년`);

  const yearsLabel = name.match(/(\d+)년\s*국채/);
  if (yearsLabel) return trimLabel(`국고채 ${yearsLabel[1]}년`);

  const series = name.match(/\((\d{2})-\d+\)\s*$/);
  if (series && /국고|국채|통안|물가연동/.test(name)) {
    return trimLabel(`국고채 ${series[1]}년 만기`);
  }

  if (/물가연동국고|물가연동\s*국고/.test(name)) return null;
  if (/통화안정|통안채/.test(name)) return trimLabel("통안채");
  if (/국고|국채/.test(name)) return null;

  return null;
}

/** PLUS 국채선물10년, KODEX 26-12 금융채(AA-이상)액티브 — 브랜드·만기·등급·상품 유형 유지 */
function formatDomesticBondEtf(name: string): string | null {
  const m = name.match(DOMESTIC_BOND_ETF_RE);
  if (!m) return null;

  const brand = m[1].toUpperCase();
  const rest = m[2].trim();
  if (!DOMESTIC_BOND_ETF_REST_RE.test(rest)) return null;

  const grade = extractCreditGrade(rest);
  const series = extractSeriesMaturity(rest);
  let product: string | null = null;

  const futuresTenor = rest.match(/국채\s*선물(\d+)년|국채선물(\d+)년/i);
  if (futuresTenor) {
    product = `국채선물${futuresTenor[1] ?? futuresTenor[2]}년`;
  } else if (/(?:국고채|국채)(\d+)년/i.test(rest)) {
    const tenor = rest.match(/(?:국고채|국채)(\d+)년/i)?.[1];
    product = tenor ? `국고채${tenor}년` : "국고채";
    if (/액티브/.test(rest)) product += "액티브";
  } else if (/단기채권|초단기채권/.test(rest)) {
    product = /액티브/.test(rest) ? "단기채권액티브" : "단기채권";
  } else if (/단기사채/.test(rest)) {
    product = "단기사채";
  } else if (/중기.*종합|중기종합/.test(rest)) {
    product = withGrade("중기종합", grade);
  } else if (/종합채권/.test(rest)) {
    product = withGrade("종합채권", grade);
  } else if (/우량회사채/.test(rest)) {
    product = /액티브/.test(rest) ? "우량회사채액티브" : "우량회사채";
  } else if (/금융채/.test(rest)) {
    const base = series ? `${series} 금융` : "금융채";
    product = withGrade(base, grade);
    if (/액티브/.test(rest) && !product.endsWith("액티브")) product += "액티브";
  } else if (/회사채/.test(rest)) {
    product = withGrade(/액티브/.test(rest) ? "회사채액티브" : "회사채", grade);
  } else if (/머니마켓|MMF|국공채머니마켓/.test(rest)) {
    product = /액티브/.test(rest) ? "머니마켓액티브" : "머니마켓";
  } else if (/전단채/.test(rest)) {
    product = "전단채";
  } else if (/채권|BOND/i.test(rest)) {
    product = withGrade(/액티브/.test(rest) ? "채권액티브" : "채권", grade);
  }

  if (!product) return null;
  return trimLabel(`${brand} ${product}`, ETF_LABEL_LEN);
}

/** KODEX 국고채3년, RISE 머니마켓액티브, WON 전단채플러스 */
function formatDomesticBondProduct(name: string): string | null {
  const etf = formatDomesticBondEtf(name);
  if (etf) return etf;

  if (isDomesticBondEtfName(name)) return null;
  if (/머니마켓|MMF|국공채머니마켓/.test(name)) return trimLabel("머니마켓");
  if (/전단채/.test(name)) return trimLabel("전단채");
  if (/단기채|단기사채/.test(name)) return trimLabel("단기사채");

  const govEtf = name.match(/(?:국고채|국채)(\d+)년/i);
  if (govEtf && /KODEX|TIGER|RISE|SOL|ACE|PLUS|1Q|KOSEF|HANARO|KIWOOM|WON/i.test(name)) {
    return trimLabel(`국고채${govEtf[1]}년`, ETF_LABEL_LEN);
  }

  // 실제 국고채 보유 종목(국고채권…, 물가연동국고…)은 formatKrGovBond에서 처리
  if (/국고채|국채액티브|KIS국고/.test(name)) return null;
  if ((/회사채|크레딧/.test(name) || /금융채/.test(name)) && DOMESTIC_ETF_BRAND_RE.test(name)) {
    return trimLabel(/금융채/.test(name) ? "금융채ETF" : "회사채ETF");
  }
  if (/채권|BOND/i.test(name) && DOMESTIC_ETF_BRAND_RE.test(name)) {
    return trimLabel("채권ETF");
  }

  return null;
}

const OVERSEAS_BOND_ETF_RULES: [RegExp, string][] = [
  [/INVESTMENT\s*GRADE|IBOX|LQD|IG\s*BOND|\bCORPO\b/i, "우량회사채ETF"],
  [/HIGH\s*YIELD|\bHYG\b|\bJNK\b/i, "하이일드ETF"],
  [/EMERGING|\bEM\s*DEBT|\bEMB\b/i, "신흥국채ETF"],
  [/MORTGAGE|\bMBS\b|\bMBB\b|\bVMBS\b/i, "모기지채ETF"],
  [/TREASURY|\bGOVT\b|\bUST\b|US\s*GOVERNMENT/i, "미국국채ETF"],
  [/\bTIPS\b|\bTIP\b|\bSTIP\b/i, "물가연동ETF"],
  [/AGGREGATE|\bAGG\b|TOTAL\s*BOND|\bBND\b/i, "종합채권ETF"],
  [/CORPORATE|\bCORP\b/i, "회사채ETF"],
  [/INTERNATIONAL|\bBWX\b|\bIEF\b/i, "해외국채ETF"],
  [/MUNICIPAL|\bMUB\b/i, "지방채ETF"],
  [/FLOATING|\bFLOT\b/i, "변동금리ETF"],
  [/SHORT\s*DURATION|\bSHV\b|\bBIL\b|\bSGOV\b/i, "단기국채ETF"],
];

/** iShares iBoxx USD Investment Grade…, Vanguard Total Bond… */
function formatOverseasBondEtf(name: string): string | null {
  if (isOverseasEquityEtfName(name)) return null;

  const upper = name.toUpperCase();
  const looksLikeBondFund =
    /BOND|DEBT|FIXED|INCOME|CREDIT|TREASURY|GOVT|IBOX|LQD|AGGREGATE|TIPS|MORTGAGE|MBS|HIGH\s*YIELD|CORPORATE/i.test(
      upper,
    );
  if (!looksLikeBondFund) return null;

  for (const [pattern, label] of OVERSEAS_BOND_ETF_RULES) {
    if (pattern.test(upper)) return trimLabel(label);
  }

  if (/BOND|DEBT|FIXED|INCOME|CREDIT|TREASURY|GOVT/i.test(upper)) {
    return trimLabel("해외채권ETF");
  }

  return null;
}

function formatLiquidity(name: string): string | null {
  if (isKrBankSerialBondName(name)) return null;
  if (/원화현금|설정현금|현금및/.test(name)) return trimLabel("원화현금");
  if (/양도성예금|예금증서|\(CD\)|\(CD |CD\)/.test(name)) return trimLabel("CD");
  if (/(\(CP\)|\(CP |CP\)|\(단\)|\(할\))/.test(name) && !/ETF/i.test(name)) {
    if (isPreservedSerialBondName(name)) return null;
    if (/[\uAC00-\uD7A3]/.test(name) && /\d{8}-\d+/.test(name)) return null;
    return trimLabel("CP");
  }
  if (/머니마켓|MMF/.test(name)) return trimLabel("머니마켓");
  return null;
}

function isOpaqueBondCodeName(name: string): boolean {
  return (
    /채권\d|국고\d|^\d{8}-|\(\d{2}-\d+\)|^[A-Z]{1,5}\s+\d|T\s+\d|^\d+-\d+\s*$/.test(name) ||
    isOverseasListedBondName(name) ||
    isKrBankSerialBondName(name) ||
    name.length > MAX_LABEL_LEN
  );
}

function bondTypeSuffix(assetClass: AssetClassId | null, issuer: string): string | null {
  if (/카드$/.test(issuer)) return null;
  if (/캐피탈$/.test(issuer)) return "금융채";
  if (/증권$|금융투자$/.test(issuer)) return assetClass === "cp" ? "CP" : "금융채";
  if (/전력|가스|철도|도로|항공|공사|금융|주택/.test(issuer)) return "공사채";

  switch (assetClass) {
    case "fin_bond":
      return "금융채";
    case "corp_bond":
      return "회사채";
    case "agency_bond":
      return "공사채";
    case "cp":
      return "CP";
    case "gov_bond":
      return "국채";
    default:
      return null;
  }
}

/** 삼성카드, KB캐피탈123, 한국전력공사… — 발행사 + (필요 시) 채권 유형 */
function formatIssuerBond(name: string, assetClass: AssetClassId | null): string | null {
  const issuer = extractBondIssuerShortName(name);
  if (!issuer) return null;

  const suffix = bondTypeSuffix(assetClass, issuer);
  if (!suffix) return trimLabel(issuer);

  const withSuffix = `${issuer} ${suffix}`;
  if (withSuffix.length <= MAX_LABEL_LEN) return trimLabel(withSuffix);
  return trimLabel(issuer);
}

function assetClassFallback(name: string, assetClass: AssetClassId): string {
  const issuerLabel = formatIssuerBond(name, assetClass);
  if (issuerLabel) return issuerLabel;

  if (!isOpaqueBondCodeName(name) && /[\uAC00-\uD7A3]/.test(name)) {
    return trimLabel(formatBondIssuerDisplayName(name));
  }

  switch (assetClass) {
    case "overseas_bond":
      return trimLabel("해외채");
    case "cp":
      return trimLabel("CP");
    case "gov_bond":
      if (/[\uAC00-\uD7A3]/.test(name) && name.length <= PRESERVED_BOND_MAX_LEN) {
        return trimLabel(name, PRESERVED_BOND_MAX_LEN);
      }
      return trimLabel("국고채");
    case "agency_bond":
      return trimLabel("공사채");
    case "fin_bond":
      return trimLabel("금융채");
    default:
      return trimLabel("회사채");
  }
}

function simplifyTrsUnderlying(text: string): string {
  const cleaned = text
    .replace(/레버리지|SOLACTIVE|인덱스|INDEX/gi, "")
    .replace(/\s+/g, "")
    .trim();

  const aliases: [RegExp, string][] = [
    [/차이나전기차/i, "중국전기차"],
    [/차이나클린에너지/i, "중국클린"],
    [/차이나/i, "중국"],
    [/미국/i, "미국"],
    [/일본/i, "일본"],
  ];
  for (const [re, label] of aliases) {
    if (re.test(cleaned)) return label;
  }

  const hangul = cleaned.match(/^[\uAC00-\uD7A3]+/)?.[0];
  if (hangul) return hangul.length <= 8 ? hangul : hangul.slice(0, 7);

  return cleaned.slice(0, 8);
}

/** 스왑(하나증권)_…, 차이나전기차 TRS 260130-01 */
function formatTrsOrSwap(name: string): string | null {
  if (!/\bTRS\b|총수익|스왑|SWAP/i.test(name)) return null;

  const parenSwap = name.match(/스왑\s*\(([^)]+)\)/);
  if (parenSwap) {
    const issuer = formatBondIssuerDisplayName(parenSwap[1].trim())
      .replace(/금융투자$/, "")
      .replace(/투자증권$/, "증권");
    return trimLabel(`${issuer} 스왑`);
  }

  const trsMatch = name.match(/^(.+?)\s+TRS\b/i);
  if (trsMatch) {
    const underlying = simplifyTrsUnderlying(trsMatch[1].trim());
    const label = `${underlying} TRS`;
    return trimLabel(label.length <= MAX_LABEL_LEN ? label : `${underlying.slice(0, 6)} TRS`);
  }

  if (/총수익/.test(name)) {
    const head = name.split(/총수익|스왑|SWAP/i)[0]?.trim();
    if (head && head.length >= 2) return trimLabel(`${simplifyTrsUnderlying(head)} TRS`);
  }

  const issuer = extractBondIssuerShortName(name);
  if (issuer) return trimLabel(`${issuer} 스왑`);

  return trimLabel("스왑");
}

/**
 * 채권·유동성 자산 UI 표시명 (토스 스타일 단순화).
 * 원문은 original 필드 / 툴팁으로 보존.
 */
export function resolveBondDisplayName(
  stockName?: string | null,
  stockCode?: string | null,
): BondDisplayResult | null {
  const original = stockName?.trim();
  if (!original) return null;

  if (isDomesticBondEtfName(original)) {
    return { display: original, original, simplified: false };
  }

  if (shouldPreserveBondDisplayName(original)) {
    const display =
      original.length <= PRESERVED_BOND_MAX_LEN
        ? original
        : `${original.slice(0, PRESERVED_BOND_MAX_LEN - 1)}…`;
    return { display, original, simplified: display !== original };
  }

  const assetClass = inferAssetClass(original, stockCode);

  const candidates = [
    formatKrMoneyMarketInstrument(original),
    formatKrBankSerialBond(original),
    formatLiquidity(original),
    formatTrsOrSwap(original),
    formatKoreanOverseasListedBond(original),
    formatUsTreasury(original),
    formatUsCorporateBond(original),
    formatKrGovBond(original),
    formatDomesticBondProduct(original),
    formatOverseasBondEtf(original),
    formatIssuerBond(original, assetClass),
  ].filter(Boolean) as string[];

  if (!candidates.length) {
    if (!assetClass) return null;
    candidates.push(assetClassFallback(original, assetClass));
  }

  let display = candidates[0]!;
  if (display !== original && isOpaqueBondCodeName(original) === false) {
    const issuer = extractBondIssuerShortName(original);
    if (issuer && display.match(/^(금융채|회사채|공사채|국고채|CP|해외채)$/)) {
      display = formatIssuerBond(original, assetClass) ?? trimLabel(issuer);
    }
  }
  const simplified = display !== original;
  return { display, original, simplified };
}
