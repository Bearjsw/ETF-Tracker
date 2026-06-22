import { formatManagerDisplay } from "@/lib/managers";
import { isBondLikeAsset, resolveBondIssuerLogo } from "@/lib/bond-issuer";
import { looksLikeOverseasStockName, resolveStockTickerSymbol } from "@/lib/stock-ticker-resolve";
import { canResolveTickerLogo, expandTickerLogoPaths } from "@/lib/stock-logo-variants";
import {
  isListedStockCodeProxy,
  resolveDomesticEtfBrandLogo,
} from "@/lib/domestic-etf-product";
import {
  resolveDomesticCodeLogo,
  resolveKoreanNameLogo,
} from "@/lib/stock-logo-index";
import { getCountryFlagLogoPath, shouldUseCountryFlagIcon } from "@/lib/stock-country";

const STOCK_FALLBACK = "/logos/stock/common_KONEX.svg";
const STOCK_OVERSEAS_FALLBACK = "/logos/stock/common_ETF_us.svg";
const MANAGER_FALLBACK = "/logos/financial/증권/SK.svg";

/** ETF 자산운용사명 → financial 하위 로고 경로 (확장자 제외) */
const MANAGER_LOGO_MAP: Record<string, string> = {
  삼성자산운용: "financial/증권/삼성",
  미래에셋자산운용: "financial/증권/미래에셋",
  "미래에셋자산운용(주)": "financial/증권/미래에셋",
  KB자산운용: "financial/증권/KB",
  "KB자산운용(주)": "financial/증권/KB",
  한국투자신탁운용: "financial/증권/한국투자",
  한국투자신탁운용주식회사: "financial/증권/한국투자",
  신한자산운용: "financial/증권/신한투자",
  "신한자산운용(주)": "financial/증권/신한투자",
  NH아문디자산운용: "financial/증권/NH투자",
  "NH아문디자산운용(주)": "financial/증권/NH투자",
  키움투자자산운용: "financial/증권/키움",
  "키움투자자산운용(주)": "financial/증권/키움",
  하나자산운용: "financial/증권/하나금융투자",
  "하나자산운용(주)": "financial/증권/하나금융투자",
  한화자산운용: "financial/증권/한화투자",
  "한화자산운용(주)": "financial/증권/한화투자",
  BNK자산운용: "financial/증권/BNK투자",
  IBK자산운용: "financial/증권/IBK투자",
  대신자산운용: "financial/증권/대신",
  유진자산운용: "financial/증권/유진투자",
  메리츠자산운용: "financial/증권/메리츠",
  타임폴리오자산운용: "financial/증권/한국투자",
  "타임폴리오자산운용(주)": "financial/증권/한국투자",
  아이엠자산운용: "financial/증권/한국투자",
  우리자산운용: "financial/증권/우리금융",
  교보악사자산운용: "financial/증권/교보",
  흥국자산운용: "financial/증권/흥국",
  현대자산운용: "financial/증권/현대차",
  DB자산운용: "financial/증권/DB금융투자",
  SK자산운용: "financial/증권/SK",
};

const MANAGER_KEYWORD_MAP: [RegExp, string][] = [
  [/삼성/, "financial/증권/삼성"],
  [/미래에셋/, "financial/증권/미래에셋"],
  [/^KB|케이비/, "financial/증권/KB"],
  [/한국투자|타임폴리오/, "financial/증권/한국투자"],
  [/신한/, "financial/증권/신한투자"],
  [/NH|아문디/, "financial/증권/NH투자"],
  [/키움/, "financial/증권/키움"],
  [/하나/, "financial/증권/하나금융투자"],
  [/한화/, "financial/증권/한화투자"],
  [/BNK/, "financial/증권/BNK투자"],
  [/IBK/, "financial/증권/IBK투자"],
  [/대신/, "financial/증권/대신"],
  [/유진/, "financial/증권/유진투자"],
  [/메리츠/, "financial/증권/메리츠"],
  [/우리/, "financial/증권/우리금융"],
  [/교보/, "financial/증권/교보"],
  [/흥국/, "financial/증권/흥국"],
  [/현대/, "financial/증권/현대차"],
  [/DB/, "financial/증권/DB금융투자"],
  [/^SK/, "financial/증권/SK"],
];

const STOCK_NAME_ALIASES: Record<string, string> = {
  네이버: "NAVER",
  케이티: "KT",
  엔비디아: "NVDA",
  애플: "AAPL",
  테슬라: "TSLA",
  마이크로소프트: "MSFT",
  아마존: "AMZN",
  알파벳: "GOOGL",
  구글: "GOOGL",
  메타: "META",
  페이스북: "META",
};

/** US 티커와 겹치는 국내 종목 — GS(078930)≠Goldman Sachs, KT(030200)≠US KT, NC(036570)≠US NC */
const DOMESTIC_CODE_LOGO: Record<string, string> = {
  "078930": "stock/GS_078930",
  "030200": "stock/KT_030200",
  "033780": "stock/KTnG_033780",
  "036570": "stock/엔씨소프트",
};

const DOMESTIC_NAME_LOGO: Record<string, string> = {
  KT: "stock/KT_030200",
  "KT&G": "stock/KTnG_033780",
  NC: "stock/엔씨소프트",
  NCSOFT: "stock/엔씨소프트",
  엔씨소프트: "stock/엔씨소프트",
};

function normalizeDomesticCode(stockCode?: string | null): string | null {
  const raw = stockCode?.trim();
  if (!raw) return null;
  if (/^\d{1,6}$/.test(raw)) return raw.padStart(6, "0");
  return raw;
}

/** 종목명 변형(케이티, KT(주), KT & G 등) → 국내 전용 로고 */
function resolveDomesticNameLogo(stockName?: string | null): string | null {
  const name = stockName?.trim();
  if (!name) return null;

  if (DOMESTIC_NAME_LOGO[name]) return DOMESTIC_NAME_LOGO[name];
  if (/^KT\s*&\s*G/i.test(name) || name.startsWith("KT&G")) return DOMESTIC_NAME_LOGO["KT&G"];
  if (name === "케이티" || /^KT(\s|$|\(|주)/i.test(name)) return DOMESTIC_NAME_LOGO.KT;
  if (name === "NC" || /^NC\s*SOFT/i.test(name) || name.includes("엔씨소프트")) {
    return DOMESTIC_NAME_LOGO.NC;
  }

  return null;
}

function isDomesticUsTickerCollision(stockName: string, stockCode?: string | null): boolean {
  const code = normalizeDomesticCode(stockCode);
  if (!code || !/^\d{6}$/.test(code)) return false;
  const upper = stockName.trim().toUpperCase();
  if (!/^[A-Z]{1,5}$/.test(upper)) return false;
  if (DOMESTIC_CODE_LOGO[code] || resolveDomesticNameLogo(stockName)) return true;
  if (/^(0000|1000)\d{2}$/.test(code)) return false;
  return false;
}

function shouldUseUsTickerLogo(
  ticker: string | null,
  stockName?: string | null,
  stockCode?: string | null,
): boolean {
  if (!ticker) return false;
  const code = normalizeDomesticCode(stockCode);
  if (code && DOMESTIC_CODE_LOGO[code] && !looksLikeOverseasStockName(stockName, code)) {
    return false;
  }
  if (ticker === "KT" && (code === "030200" || resolveDomesticNameLogo(stockName))) return false;
  if (ticker === "NC" && (code === "036570" || resolveDomesticNameLogo(stockName))) return false;
  return true;
}

function logoPath(base: string) {
  return `/logos/${base}.svg`;
}

function isUsTicker(code: string) {
  return /^[A-Z]{1,5}$/.test(code);
}

function normalizeStockName(name: string) {
  return STOCK_NAME_ALIASES[name] ?? name.trim();
}

export function getStockLogoCandidates(stockName?: string | null, stockCode?: string | null): string[] {
  const candidates: string[] = [];
  const code = normalizeDomesticCode(stockCode);

  if (isBondLikeAsset(stockName, code)) {
    const bondLogo = resolveBondIssuerLogo(stockName);
    if (bondLogo) candidates.push(logoPath(bondLogo));
    candidates.push(STOCK_FALLBACK);
    return [...new Set(candidates)];
  }

  const normalizedName = stockName ? normalizeStockName(stockName) : null;
  const ticker = resolveStockTickerSymbol(normalizedName ?? stockName, code);
  const domesticNameLogo = resolveDomesticNameLogo(stockName);
  const domesticCodeLogo = code ? resolveDomesticCodeLogo(code) : null;
  const koreanNameLogo = resolveKoreanNameLogo(stockName);
  const overseas = looksLikeOverseasStockName(stockName, code);
  const codeProxy = isListedStockCodeProxy(stockName, code);

  if (code && DOMESTIC_CODE_LOGO[code] && !overseas && !codeProxy) {
    candidates.push(logoPath(DOMESTIC_CODE_LOGO[code]));
  }

  if (domesticCodeLogo && !overseas && !codeProxy) {
    candidates.push(logoPath(`stock/${encodeURIComponent(domesticCodeLogo)}`));
  }

  const brandLogo = codeProxy ? resolveDomesticEtfBrandLogo(stockName) : null;
  if (brandLogo) {
    candidates.push(logoPath(brandLogo));
  }

  if (domesticNameLogo) {
    candidates.push(logoPath(domesticNameLogo));
    if (domesticNameLogo.includes("KTnG")) {
      candidates.push("/logos/stock/KT&amp;G.svg");
    }
  }

  if (koreanNameLogo && !overseas) {
    candidates.push(logoPath(`stock/${encodeURIComponent(koreanNameLogo)}`));
    if (koreanNameLogo.includes("&amp;")) {
      candidates.push(logoPath(`stock/${koreanNameLogo}`));
    }
  }

  if (ticker && shouldUseUsTickerLogo(ticker, stockName, code) && canResolveTickerLogo(ticker)) {
    candidates.push(...expandTickerLogoPaths(ticker));
  }

  if (code && isUsTicker(code) && canResolveTickerLogo(code)) {
    candidates.push(...expandTickerLogoPaths(code));
  }

  const domesticLogoMatched = Boolean(
    (code && (DOMESTIC_CODE_LOGO[code] || domesticCodeLogo)) || domesticNameLogo || koreanNameLogo,
  );

  if (
    normalizedName &&
    !(domesticLogoMatched && (normalizedName === "KT" || normalizedName === "NC")) &&
    !overseas
  ) {
    if (!isDomesticUsTickerCollision(normalizedName, code)) {
      candidates.push(logoPath(`stock/${encodeURIComponent(normalizedName)}`));
      if (stockName && normalizedName !== stockName.trim()) {
        candidates.push(logoPath(`stock/${encodeURIComponent(stockName.trim())}`));
      }
      if (stockName?.includes("&")) {
        candidates.push(logoPath(`stock/${encodeURIComponent(stockName.trim().replace(/&/g, "&amp;"))}`));
      }
    }
  }

  if (code && /^\d{6}$/.test(code) && !overseas && !codeProxy) {
    candidates.push(logoPath(`stock/${code}`));
  }

  const countryFlag = shouldUseCountryFlagIcon(stockName, code, ticker);
  if (countryFlag) {
    candidates.push(getCountryFlagLogoPath(countryFlag));
  }

  if (ticker || overseas) {
    if (!countryFlag) {
      candidates.push(STOCK_OVERSEAS_FALLBACK);
    }
  }

  candidates.push(STOCK_FALLBACK);
  return [...new Set(candidates)];
}

export function getStockLogoPath(stockName?: string | null, stockCode?: string | null) {
  return getStockLogoCandidates(stockName, stockCode)[0] ?? STOCK_FALLBACK;
}

export function resolveManagerLogoBase(manager: string | null | undefined): string {
  if (!manager) return MANAGER_FALLBACK.replace("/logos/", "").replace(".svg", "");

  const short = formatManagerDisplay(manager);
  const direct = MANAGER_LOGO_MAP[short] ?? MANAGER_LOGO_MAP[manager.trim()];
  if (direct) return direct;

  for (const [pattern, base] of MANAGER_KEYWORD_MAP) {
    if (pattern.test(short)) return base;
  }

  return MANAGER_FALLBACK.replace("/logos/", "").replace(".svg", "");
}

export function getManagerLogoPath(manager: string | null | undefined) {
  return logoPath(resolveManagerLogoBase(manager));
}

export function getManagerLogoCandidates(manager: string | null | undefined): string[] {
  const primary = getManagerLogoPath(manager);
  return primary === MANAGER_FALLBACK ? [primary] : [primary, MANAGER_FALLBACK];
}
