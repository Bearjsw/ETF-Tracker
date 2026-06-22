import { KRX_OVERSEAS_CODE_TICKERS } from "@/lib/overseas-ticker-map";
import { isUsListedTicker } from "@/lib/stock-universe";
import {
  inferStockMarket,
  normalizeOverseasCompanyName,
  resolveStockTickerSymbol,
} from "@/lib/stock-ticker-resolve";

/** ISO 3166-1 alpha-2 — 한국·미국 제외 해외 종목 아이콘용 */
export type OverseasCountryCode =
  | "CN"
  | "HK"
  | "JP"
  | "TW"
  | "DE"
  | "FR"
  | "NL"
  | "DK"
  | "CH"
  | "GB"
  | "CA"
  | "AU"
  | "SG"
  | "US";

const EXCHANGE_SUFFIX_COUNTRY: Record<string, OverseasCountryCode> = {
  SS: "CN",
  SZ: "CN",
  HK: "HK",
  T: "JP",
  TW: "TW",
  DE: "DE",
  PA: "FR",
  L: "GB",
  SW: "CH",
  TO: "CA",
  AX: "AU",
  SI: "SG",
};

/** 미국 상장 ADR/OTC라도 본사 소재지 기준 국가 */
const TICKER_HOME_COUNTRY: Record<string, OverseasCountryCode> = {
  SAP: "DE",
  RHM: "DE",
  SIEGY: "DE",
  SNY: "FR",
  ASML: "NL",
  TSM: "TW",
  NVO: "DK",
  NVS: "CH",
  RHHBY: "CH",
  LNVGY: "CN",
  BABA: "CN",
  JD: "CN",
  PDD: "CN",
  BIDU: "CN",
  NTES: "CN",
  TME: "CN",
  LI: "CN",
  NIO: "CN",
  XPEV: "CN",
  BILI: "CN",
};

const NAME_COUNTRY_RULES: [RegExp, OverseasCountryCode][] = [
  [/RHEINMETALL|SIEMENS|DEUTSCHE|BAYER|BASF|ALLIANZ|ADIDAS|MUNICH|FRANKFURT/i, "DE"],
  [/SANOFI|LVMH|L'OREAL|AIRBUS|PARIS/i, "FR"],
  [/ASML|PHILIPS|AMSTERDAM/i, "NL"],
  [/NOVO[\s-]*NORDISK|MAERSK|COPENHAGEN/i, "DK"],
  [/NESTLE|NOVARTIS|ROCHE|ZURICH/i, "CH"],
  [
    /CHINA|ZHONG|JIANGSU|GUANGZHOU|SHANGHAI|WUXI|ZHEJIANG|HENGRUI|HUAYOU|AMPEREX|TINCI|INNOLIGHT|ILUVATAR|SUPCON|SHUANGHUAN|UNITED NOVA/i,
    "CN",
  ],
  [/HONG\s*KONG|BIOLOGICS.*HK/i, "HK"],
  [/JAPAN|KIOXIA|TOYOTA|SOFTBANK|TOKYO/i, "JP"],
  [/TAIWAN|TSMC/i, "TW"],
  [/LONDON|BP\s|HSBC|GLAXO/i, "GB"],
  [/SINGAPORE/i, "SG"],
  [/TORONTO|CANADIAN/i, "CA"],
  [/SYDNEY|AUSTRALIA/i, "AU"],
];

function countryFromTickerSymbol(ticker?: string | null): OverseasCountryCode | null {
  const symbol = ticker?.trim().toUpperCase();
  if (!symbol) return null;

  const dot = symbol.lastIndexOf(".");
  if (dot > 0) {
    const suffix = symbol.slice(dot + 1);
    const fromSuffix = EXCHANGE_SUFFIX_COUNTRY[suffix];
    if (fromSuffix) return fromSuffix;
  }

  const base = symbol.replace(/\.[A-Z]+$/i, "");
  return TICKER_HOME_COUNTRY[base] ?? TICKER_HOME_COUNTRY[symbol] ?? null;
}

function countryFromName(stockName?: string | null): OverseasCountryCode | null {
  const upper = normalizeOverseasCompanyName(stockName ?? "");
  if (!upper) return null;
  for (const [pattern, country] of NAME_COUNTRY_RULES) {
    if (pattern.test(upper)) return country;
  }
  return null;
}

function countryFromKrxCode(stockCode?: string | null): OverseasCountryCode | null {
  const code = (stockCode ?? "").trim();
  if (!code) return null;
  const mapped = KRX_OVERSEAS_CODE_TICKERS[code];
  return countryFromTickerSymbol(mapped);
}

/**
 * 해외 종목의 본사/상장 국가. 한국은 null(기존 국내 로고), 미국은 "US".
 */
export function resolveOverseasStockCountry(
  stockName?: string | null,
  stockCode?: string | null,
  ticker?: string | null,
): OverseasCountryCode | null {
  if (inferStockMarket(stockName, stockCode) !== "overseas") return null;

  const resolvedTicker = ticker ?? resolveStockTickerSymbol(stockName, stockCode);

  return (
    countryFromTickerSymbol(resolvedTicker) ??
    countryFromKrxCode(stockCode) ??
    countryFromName(stockName) ??
    (resolvedTicker && isUsListedTicker(resolvedTicker.replace(/\.[A-Z]+$/i, "")) ? "US" : null) ??
    (resolvedTicker && /^[A-Z]{1,5}$/.test(resolvedTicker) ? "US" : null)
  );
}

export function getCountryFlagLogoPath(country: OverseasCountryCode): string {
  return `/logos/flags/${country}.svg`;
}

/** 한·미가 아닌 해외 종목 — 국기/국가색 아이콘 사용 */
export function shouldUseCountryFlagIcon(
  stockName?: string | null,
  stockCode?: string | null,
  ticker?: string | null,
): OverseasCountryCode | null {
  const country = resolveOverseasStockCountry(stockName, stockCode, ticker);
  if (!country || country === "US") return null;
  return country;
}
