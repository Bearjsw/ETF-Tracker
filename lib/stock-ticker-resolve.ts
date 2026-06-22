import { inferAssetClass, type AssetClassId } from "@/lib/asset-class";
import { KRX_OVERSEAS_CODE_TICKERS, OVERSEAS_NAME_FRAGMENTS } from "@/lib/overseas-ticker-map";
import {
  ASCII_LOGO_STEMS,
  hasAsciiLogoStem,
  resolveDomesticAsciiNameLogo,
  resolveDomesticCodeLogo,
} from "@/lib/stock-logo-index";
import {
  isDomesticEtfBrandProduct,
  isListedStockCodeProxy,
  nameMatchesDomesticListing,
} from "@/lib/domestic-etf-product";
import { isBondLikeAsset } from "@/lib/bond-issuer";
import { isKrxListedStock, isUsListedTicker } from "@/lib/stock-universe";

export type StockMarket = "domestic" | "overseas";

const OVERSEAS_NAME_RE = /[A-Z]{4,}/;

/** KRX가 여러 해외종목에 재사용하는 범용 프록시 코드 — 코드→티커 1:1 매핑 불가 */
const AMBIGUOUS_OVERSEAS_PROXY_RE = /^(0000\d{2}|1000\d{2})$/;

/** 종목명에 한글 포함 */
export function containsHangul(stockName?: string | null): boolean {
  return /[\uAC00-\uD7A3]/.test(stockName ?? "");
}

/** 종목명에 한글이 주를 이루면 국내 상장주 */
export function isPrimarilyKoreanName(stockName?: string | null): boolean {
  if (!stockName) return false;
  const name = stockName.trim();
  const hangul = (name.match(/[\uAC00-\uD7A3]/g) ?? []).length;
  if (hangul < 2) return false;
  const latin = (name.match(/[A-Za-z]/g) ?? []).length;
  return hangul >= latin;
}

export function isKrxSixDigitCode(stockCode?: string | null): boolean {
  const code = (stockCode ?? "").trim();
  return /^[0-9]{6}$/.test(code) && code !== "000000";
}

function isUsTickerSymbol(code: string): boolean {
  return /^[A-Z]{1,5}$/.test(code);
}

export function isAmbiguousOverseasProxyCode(stockCode?: string | null): boolean {
  const code = (stockCode ?? "").trim();
  return AMBIGUOUS_OVERSEAS_PROXY_RE.test(code);
}

const SKIP_OVERSEAS_FRAGMENT_RE =
  /[\uAC00-\uD7A3]|KODEX|TIGER|RISE|ARIRANG|HANARO|SOL\b|ACE\b|PLUS\b|1Q\b|KOSEF|채권|국고|회사채|금융채|통안|CLASS\b/i;

function isUsableOverseasFragment(fragment: string, ticker: string): boolean {
  if (SKIP_OVERSEAS_FRAGMENT_RE.test(fragment)) return false;
  if (ticker.length < 2) return false;
  if (ticker.endsWith(".KQ") || ticker.endsWith(".KS")) return false;
  if (hasAsciiLogoStem(ticker)) return true;
  return fragment.length >= 8;
}

function fragmentMatchesName(upper: string, fragment: string): boolean {
  if (fragment.length >= 6) return upper.includes(fragment);
  const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[\\s/(])${escaped}(?:[\\s/.,)]|$)`).test(upper);
}

function matchTickerFromName(name: string, stockCode?: string | null): string | null {
  const upper = normalizeOverseasCompanyName(name);
  const code = (stockCode ?? "").trim();

  const sorted = Object.entries(OVERSEAS_NAME_FRAGMENTS).sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [fragment, ticker] of sorted) {
    if (
      fragment.length >= 4 &&
      fragmentMatchesName(upper, fragment) &&
      isUsableOverseasFragment(fragment, ticker)
    ) {
      return ticker;
    }
  }

  const fromStem = matchLogoStemInName(upper);
  if (fromStem) return fromStem;

  if (/^[A-Z]{1,5}$/.test(upper) && hasAsciiLogoStem(upper)) {
    if (code && isKrxListedStock(code)) return null;
    if (isUsListedTicker(upper) || hasAsciiLogoStem(upper)) return upper;
  }

  return null;
}

/** 로고 파일명(티커)이 종목명에 포함되는 경우 — fragment 미등록 종목 보완 */
function matchLogoStemInName(upper: string): string | null {
  const stems = [...ASCII_LOGO_STEMS]
    .map((s) => s.replace(/\.[A-Z]$/, ""))
    .filter((s) => /^[A-Z]{2,5}$/.test(s))
    .sort((a, b) => b.length - a.length);

  const seen = new Set<string>();
  for (const base of stems) {
    if (seen.has(base)) continue;
    seen.add(base);
    if (base.length < 3) continue;
    if (!hasAsciiLogoStem(base)) continue;
    const re = new RegExp(`(?:^|[\\s/(])${base}(?:[\\s/.,)]|$)`);
    if (re.test(upper)) return base;
  }
  return null;
}

/** KRX ETF 보유 해외종목명 정규화 (Inc -A, CL A, THE 등 제거) */
export function normalizeOverseasCompanyName(stockName: string): string {
  return stockName
    .toUpperCase()
    .replace(/[''`]/g, "")
    .replace(/\s*-\s*CL\s*[A-Z]\b/g, "")
    .replace(/\s*-\s*[A-Z]\b(?=\s|$)/g, "")
    .replace(/\s*,?\s*(INCORPORATED|INC|CORP|CORPORATION|LTD|CO|PLC|NV|SA|AG|LP|LLC)\.?\s*(-|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isDomesticListedProduct(name: string): boolean {
  return containsHangul(name) || isPrimarilyKoreanName(name) || isDomesticEtfBrandProduct(name);
}

/** KRX 상장코드(000120 등)가 ETF 보유 해외종목 프록시로 쓰인 경우 */
function isOverseasProxyOnListedCode(name: string, code: string): boolean {
  if (!isKrxListedStock(code)) return false;
  if (containsHangul(name) || isPrimarilyKoreanName(name)) return false;
  if (!isClearlyOverseasEnglishName(name)) return false;
  if (nameMatchesDomesticListing(name, code)) return false;
  return Boolean(matchTickerFromName(name, code));
}

function isClearlyOverseasEnglishName(stockName: string): boolean {
  const upper = normalizeOverseasCompanyName(stockName);

  const sorted = Object.entries(OVERSEAS_NAME_FRAGMENTS).sort((a, b) => b[0].length - a[0].length);
  for (const [fragment] of sorted) {
    if (fragment.length >= 5 && upper.includes(fragment)) return true;
  }

  if (OVERSEAS_NAME_RE.test(upper)) return true;

  const words = upper.split(/\s+/).filter((w) => /^[A-Z]{2,}$/.test(w));
  return words.length >= 2;
}

/**
 * ETF 보유 종목의 국내/해외 시장 분류.
 * @param assetClass — 생략 시 inferAssetClass 호출, null이면 미분류(채권 아님)로 처리
 */
export function inferStockMarket(
  stockName?: string | null,
  stockCode?: string | null,
  assetClass?: AssetClassId | null,
): StockMarket {
  const name = (stockName ?? "").trim();
  const code = (stockCode ?? "").trim();
  const cls = assetClass === undefined ? inferAssetClass(name, code) : assetClass;

  if (cls === "overseas_bond") return "overseas";
  if (cls) return "domestic";

  if (code && isKrxSixDigitCode(code) && isDomesticListedProduct(name)) return "domestic";

  if (code && isKrxListedStock(code)) {
    if (isOverseasProxyOnListedCode(name, code)) return "overseas";
    return "domestic";
  }

  if (code && isUsTickerSymbol(code) && isUsListedTicker(code)) return "overseas";

  if (isKrxSixDigitCode(code)) {
    if (!isAmbiguousOverseasProxyCode(code) && KRX_OVERSEAS_CODE_TICKERS[code]) return "overseas";
    if (isClearlyOverseasEnglishName(name)) return "overseas";
    if (containsHangul(name) || isPrimarilyKoreanName(name)) return "domestic";
    return "overseas";
  }

  if (isUsListedTicker(code)) return "overseas";

  if (containsHangul(name) || isPrimarilyKoreanName(name)) return "domestic";

  return isClearlyOverseasEnglishName(name) ? "overseas" : "domestic";
}

/** KRX ETF 보유에 포함된 해외주식명(영문) 여부 — 가격·로고 등 보조 판별 */
export function looksLikeOverseasStockName(
  stockName?: string | null,
  stockCode?: string | null,
): boolean {
  return inferStockMarket(stockName, stockCode) === "overseas";
}

/** 종목명·코드에서 로고용 티커 심볼 추출 (없으면 null) */
export function resolveStockTickerSymbol(
  stockName?: string | null,
  stockCode?: string | null,
): string | null {
  const code = stockCode?.trim();
  const name = stockName?.trim();

  if (isBondLikeAsset(name, code)) return null;

  if (name) {
    const fromName = matchTickerFromName(name, code);
    if (fromName && inferStockMarket(name, code) === "overseas") {
      return fromName;
    }
  }

  if (code && isUsTickerSymbol(code) && isUsListedTicker(code)) {
    return code;
  }

  if (
    code &&
    !isAmbiguousOverseasProxyCode(code) &&
    KRX_OVERSEAS_CODE_TICKERS[code] &&
    !isKrxListedStock(code) &&
    !isDomesticListedProduct(name ?? "") &&
    inferStockMarket(name, code) === "overseas"
  ) {
    const mapped = KRX_OVERSEAS_CODE_TICKERS[code];
    if (hasAsciiLogoStem(mapped)) return mapped;
  }

  if (name && inferStockMarket(name, code) === "overseas") {
    return matchTickerFromName(name, code);
  }

  return null;
}
