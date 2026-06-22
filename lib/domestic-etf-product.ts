import { resolveDomesticCodeLogo, resolveDomesticAsciiNameLogo } from "@/lib/stock-logo-index";
import { isKrxListedStock } from "@/lib/stock-universe";

export const DOMESTIC_ETF_BRANDS =
  "KODEX|TIGER|RISE|ARIRANG|HANARO|SOL|ACE|PLUS|1Q|KOSEF|KIWOOM|WON|TIMEFOLIO|KOACT";

export const DOMESTIC_ETF_BRAND_RE = new RegExp(`^(${DOMESTIC_ETF_BRANDS})\\b`, "i");

/** KODEX/TIGER 등 국내 ETF·ELW 브랜드 상품 */
export function isDomesticEtfBrandProduct(name?: string | null): boolean {
  return DOMESTIC_ETF_BRAND_RE.test(name?.trim() ?? "");
}

export function extractDomesticEtfBrand(name: string): string | null {
  return name.trim().match(DOMESTIC_ETF_BRAND_RE)?.[1]?.toUpperCase() ?? null;
}

export function nameMatchesDomesticListing(name: string, code: string): boolean {
  const domesticStem = resolveDomesticCodeLogo(code);
  if (!domesticStem) return false;
  if (name.includes(domesticStem)) return true;

  const asciiLogo = resolveDomesticAsciiNameLogo(name);
  if (asciiLogo && asciiLogo === domesticStem) return true;

  return false;
}

/**
 * KRX 상장 종목코드가 ETF 보유 종목명과 다른 프록시로 쓰인 경우
 * (예: 000720=현대건설 vs TIGER KRX금현물)
 */
export function isListedStockCodeProxy(
  stockName?: string | null,
  stockCode?: string | null,
): boolean {
  const name = (stockName ?? "").trim();
  const code = (stockCode ?? "").trim();
  if (!name || !isKrxListedStock(code)) return false;
  if (!isDomesticEtfBrandProduct(name)) return false;
  return !nameMatchesDomesticListing(name, code);
}

/** 국내 ETF 브랜드 → 운용사 로고 (financial/…, 확장자 제외) */
export const DOMESTIC_ETF_BRAND_LOGO: Record<string, string> = {
  KODEX: "financial/증권/삼성",
  TIGER: "financial/증권/미래에셋",
  RISE: "financial/증권/KB",
  ACE: "financial/증권/한국투자",
  HANARO: "financial/증권/NH투자",
  SOL: "financial/증권/신한투자",
  PLUS: "financial/증권/한화투자",
  "1Q": "financial/증권/키움",
  KOSEF: "financial/증권/키움",
  KIWOOM: "financial/증권/키움",
  WON: "financial/증권/우리금융",
  TIMEFOLIO: "financial/증권/한국투자",
  KOACT: "financial/증권/한국투자",
  ARIRANG: "financial/증권/KB",
};

export function resolveDomesticEtfBrandLogo(name?: string | null): string | null {
  const brand = extractDomesticEtfBrand(name ?? "");
  if (!brand) return null;
  return DOMESTIC_ETF_BRAND_LOGO[brand] ?? null;
}

const LISTED_COMMODITY_ETF_RE = new RegExp(
  `^(${DOMESTIC_ETF_BRANDS})\\b.*(?:KRX)?(금현물|은현물|원유|WTI|구리|천연가스|곡물|농산물|원자재)`,
  "i",
);

export function isDomesticCommodityEtfName(name?: string | null): boolean {
  return LISTED_COMMODITY_ETF_RE.test(name?.trim() ?? "");
}

/** 국내 원자재 ETF — 상품명이 이미 충분히 짧아 원문 유지 */
export function formatDomesticCommodityEtfDisplay(name: string): {
  display: string;
  simplified: boolean;
} {
  const trimmed = name.trim();
  return { display: trimmed, simplified: false };
}
