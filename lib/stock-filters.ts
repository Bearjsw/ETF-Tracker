import { inferAssetClass } from "@/lib/asset-class";
import { isDomesticInstrument, isListedEquity, isOverseasInstrument } from "@/lib/equity-classify";
import { isTrackableStock } from "@/lib/stock-filter";
import { inferStockMarket } from "@/lib/stock-ticker-resolve";
import {
  inferKrxBoard,
  inferUsExchangeForHolding,
  type KrxBoard,
  type UsExchange,
} from "@/lib/stock-universe";

export type StockMarket = "domestic" | "overseas";

export type StockBoardFilter = "all" | KrxBoard | UsExchange;

/** UI 필터용 — 세부 채권 유형은 credit_bond 등으로 묶음 */
export type StockCategoryFilter =
  | "all"
  | "equity"
  | "bond"
  | "gov_bond"
  | "fin_bond"
  | "credit_bond"
  | "overseas_bond";

type StockCategoryDetail =
  | "equity"
  | "gov_bond"
  | "fin_bond"
  | "corp_bond"
  | "agency_bond"
  | "cp"
  | "overseas_bond";

export type ClassifiedStock = {
  market: StockMarket;
  /** 세부 분류 (필터 매칭용) */
  category: StockCategoryDetail;
  assetClass: ReturnType<typeof inferAssetClass>;
};

const CATEGORY_LABELS: Record<StockCategoryFilter, string> = {
  all: "전체",
  equity: "주식",
  bond: "채권",
  gov_bond: "국채",
  fin_bond: "금융채",
  credit_bond: "회사·공사채",
  overseas_bond: "해외채",
};

const DOMESTIC_CATEGORY_ORDER: StockCategoryFilter[] = [
  "all",
  "equity",
  "gov_bond",
  "fin_bond",
  "credit_bond",
];

const OVERSEAS_CATEGORY_ORDER: StockCategoryFilter[] = ["all", "equity", "bond"];

const ALL_MARKET_CATEGORY_ORDER: StockCategoryFilter[] = [
  "all",
  "equity",
  "gov_bond",
  "fin_bond",
  "credit_bond",
  "overseas_bond",
];

export const STOCK_MARKETS: { value: StockMarket | "all"; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "domestic", label: "국내" },
  { value: "overseas", label: "해외" },
];

export const DOMESTIC_EQUITY_BOARDS: { value: StockBoardFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "kospi", label: "코스피" },
  { value: "kosdaq", label: "코스닥" },
];

export const OVERSEAS_EQUITY_EXCHANGES: { value: StockBoardFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "nyse", label: "NYSE" },
  { value: "nasdaq", label: "NASDAQ" },
  { value: "amex", label: "AMEX" },
];

const LEGACY_CATEGORY_MAP: Record<string, StockCategoryFilter> = {
  corp_bond: "credit_bond",
  agency_bond: "credit_bond",
  cp: "credit_bond",
};

function categoryOrderForMarket(market: StockMarket | "all"): StockCategoryFilter[] {
  if (market === "overseas") return OVERSEAS_CATEGORY_ORDER;
  if (market === "domestic") return DOMESTIC_CATEGORY_ORDER;
  return ALL_MARKET_CATEGORY_ORDER;
}

/** 해외 탭에서는 해외채 세부 필터 없이 채권으로 통합 */
export function normalizeCategoryForMarket(
  market: StockMarket | "all",
  category: StockCategoryFilter,
): StockCategoryFilter {
  if (market === "overseas" && category === "overseas_bond") return "bond";
  return category;
}

function isCreditBondCategory(category: StockCategoryDetail): boolean {
  return category === "corp_bond" || category === "agency_bond" || category === "cp";
}

export function parseStockMarket(value?: string | null): StockMarket | "all" {
  if (value === "domestic" || value === "overseas") return value;
  return "all";
}

export function parseStockBoard(value?: string | null): StockBoardFilter {
  const allowed: StockBoardFilter[] = ["kospi", "kosdaq", "nyse", "nasdaq", "amex"];
  if (value && allowed.includes(value as StockBoardFilter)) return value as StockBoardFilter;
  return "all";
}

/** 국내·해외 주식 탭에서 코스피/코스닥·거래소 세분 토글 노출 여부 */
export function showEquityBoardFilter(
  market: StockMarket | "all",
  category: StockCategoryFilter,
): boolean {
  if (market === "all") return false;
  return category === "equity" || category === "all";
}

export function equityBoardOptionsForMarket(
  market: StockMarket | "all",
): { value: StockBoardFilter; label: string }[] {
  if (market === "domestic") return DOMESTIC_EQUITY_BOARDS;
  if (market === "overseas") return OVERSEAS_EQUITY_EXCHANGES;
  return [];
}

function isValidBoardForMarket(market: StockMarket | "all", board: StockBoardFilter): boolean {
  if (board === "all") return true;
  if (market === "domestic") return board === "kospi" || board === "kosdaq";
  if (market === "overseas") return board === "nyse" || board === "nasdaq" || board === "amex";
  return false;
}

export function normalizeBoardForMarket(
  market: StockMarket | "all",
  category: StockCategoryFilter,
  board: StockBoardFilter,
): StockBoardFilter {
  if (!showEquityBoardFilter(market, category)) return "all";
  return isValidBoardForMarket(market, board) ? board : "all";
}

function matchesEquityBoard(
  stockName: string | null | undefined,
  stockCode: string | null | undefined,
  market: StockMarket | "all",
  board: StockBoardFilter,
): boolean {
  if (board === "all") return true;

  const isEquity = isListedEquity(stockName, stockCode, market === "all" ? undefined : market);
  if (!isEquity) return true;

  if (board === "kospi" || board === "kosdaq") {
    return inferKrxBoard(stockCode) === board;
  }

  return inferUsExchangeForHolding(stockName, stockCode) === board;
}

export function parseStockCategory(value?: string | null): StockCategoryFilter {
  if (!value) return "all";
  if (value in LEGACY_CATEGORY_MAP) return LEGACY_CATEGORY_MAP[value];
  const allowed: StockCategoryFilter[] = [
    "all",
    "equity",
    "bond",
    "gov_bond",
    "fin_bond",
    "credit_bond",
    "overseas_bond",
  ];
  if (allowed.includes(value as StockCategoryFilter)) return value as StockCategoryFilter;
  return "all";
}

export function classifyStock(stockName?: string | null, stockCode?: string | null): ClassifiedStock {
  const name = (stockName || "").trim();
  const code = (stockCode || "").trim();
  const assetClass = inferAssetClass(name, code);
  const market: StockMarket = inferStockMarket(name, code, assetClass);

  let category: StockCategoryDetail = "equity";
  if (assetClass) {
    category =
      assetClass === "monetary_bond" ? "gov_bond" : (assetClass as StockCategoryDetail);
  }

  return { market, category, assetClass };
}

function matchesMarket(
  stockName: string | null | undefined,
  stockCode: string | null | undefined,
  market: StockMarket | "all",
): boolean {
  if (market === "all") return true;
  if (market === "domestic") return isDomesticInstrument(stockName, stockCode);
  return isOverseasInstrument(stockName, stockCode);
}

export function matchesStockFilters(
  stockName: string | null | undefined,
  stockCode: string | null | undefined,
  market: StockMarket | "all",
  category: StockCategoryFilter,
  board: StockBoardFilter = "all",
): boolean {
  if (!isTrackableStock(stockCode, stockName)) return false;
  if (!matchesMarket(stockName, stockCode, market)) return false;

  const { category: stockCategory } = classifyStock(stockName, stockCode);

  let categoryMatch = true;
  if (category === "all") categoryMatch = true;
  else if (category === "equity") {
    categoryMatch = isListedEquity(stockName, stockCode, market === "all" ? undefined : market);
  } else if (category === "bond") {
    categoryMatch = !isListedEquity(stockName, stockCode, market === "all" ? undefined : market);
  } else if (category === "credit_bond") categoryMatch = isCreditBondCategory(stockCategory);
  else categoryMatch = stockCategory === category;

  if (!categoryMatch) return false;
  return matchesEquityBoard(stockName, stockCode, market, board);
}

export function matchesStockQuery(
  stockName: string | null | undefined,
  stockCode: string | null | undefined,
  query?: string,
): boolean {
  const q = query?.trim().toLowerCase();
  if (!q) return true;
  return (
    (stockName?.toLowerCase().includes(q) ?? false) ||
    (stockCode?.toLowerCase().includes(q) ?? false)
  );
}

export function countByCategory(
  stocks: { stock_name?: string | null; stock_code: string }[],
  market: StockMarket | "all",
): Record<StockCategoryFilter, number> {
  const keys: StockCategoryFilter[] = [
    "all",
    "equity",
    "bond",
    "gov_bond",
    "fin_bond",
    "credit_bond",
    "overseas_bond",
  ];
  const counts = Object.fromEntries(keys.map((k) => [k, 0])) as Record<StockCategoryFilter, number>;

  for (const stock of stocks) {
    if (!isTrackableStock(stock.stock_code, stock.stock_name)) continue;
    if (!matchesMarket(stock.stock_name, stock.stock_code, market)) continue;
    counts.all += 1;
    const { category } = classifyStock(stock.stock_name, stock.stock_code);
    const isEquity = isListedEquity(
      stock.stock_name,
      stock.stock_code,
      market === "all" ? undefined : market,
    );

    if (isEquity) counts.equity += 1;
    if (!isEquity) counts.bond += 1;
    if (category === "gov_bond") counts.gov_bond += 1;
    if (category === "fin_bond") counts.fin_bond += 1;
    if (isCreditBondCategory(category)) counts.credit_bond += 1;
    if (category === "overseas_bond") counts.overseas_bond += 1;
  }

  return counts;
}

/** 주식 세분(코스피·코스닥·거래소) 필터 옵션 — 해당 주식이 있을 때만 노출 */
export function visibleEquityBoardOptions(
  market: StockMarket | "all",
  category: StockCategoryFilter,
  stocks: { stock_name?: string | null; stock_code: string }[],
  options?: { includeCount?: boolean },
): { value: StockBoardFilter; label: string; count?: number }[] {
  if (!showEquityBoardFilter(market, category)) return [];

  const base = equityBoardOptionsForMarket(market);
  const counts = new Map<StockBoardFilter, number>(base.map((o) => [o.value, 0]));

  for (const stock of stocks) {
    if (!matchesStockFilters(stock.stock_name, stock.stock_code, market, category, "all")) continue;
    if (!isListedEquity(stock.stock_name, stock.stock_code, market === "all" ? undefined : market)) {
      continue;
    }

    if (market === "domestic") {
      const krxBoard = inferKrxBoard(stock.stock_code);
      if (krxBoard) counts.set(krxBoard, (counts.get(krxBoard) ?? 0) + 1);
    } else if (market === "overseas") {
      const exchange = inferUsExchangeForHolding(stock.stock_name, stock.stock_code);
      if (exchange) counts.set(exchange, (counts.get(exchange) ?? 0) + 1);
    }
  }

  const equityTotal = [...counts.entries()]
    .filter(([k]) => k !== "all")
    .reduce((sum, [, n]) => sum + n, 0);
  counts.set("all", equityTotal);

  return base
    .filter((item) => item.value === "all" || (counts.get(item.value) ?? 0) > 0)
    .map((item) => ({
      ...item,
      ...(options?.includeCount ? { count: counts.get(item.value) ?? 0 } : {}),
    }));
}

/** 종목 수가 있는 필터만 노출 (전체·주식은 항상 표시) */
export function visibleCategoryOptions(
  market: StockMarket | "all",
  stocks: { stock_name?: string | null; stock_code: string }[],
  options?: { includeCount?: boolean },
): { value: StockCategoryFilter; label: string; count?: number }[] {
  const counts = countByCategory(stocks, market);

  return categoryOrderForMarket(market)
    .filter((value) => {
      if (value === "all" || value === "equity") return true;
      return (counts[value] ?? 0) > 0;
    })
    .map((value) => ({
      value,
      label: CATEGORY_LABELS[value],
      ...(options?.includeCount ? { count: counts[value] } : {}),
    }));
}
