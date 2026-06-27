import krxData from "@/data/krx_listed_codes.json";
import usData from "@/data/us_listed_tickers.json";
import { resolveStockTickerSymbol } from "@/lib/stock-ticker-resolve";

/** KRX KIND 상장종목 (FinanceDataReader KOSPI+KOSDAQ, gen_stock_universe_maps.py) */
export const KRX_LISTED_UPDATED: string = krxData.updated;

/** NYSE+NASDAQ+AMEX (FinanceDataReader, gen_stock_universe_maps.py) */
export const US_LISTED_UPDATED: string = usData.updated;

export type KrxBoard = "kospi" | "kosdaq";
export type UsExchange = "nyse" | "nasdaq" | "amex";

const krxBoards = krxData.boards ?? { kospi: [] as string[], kosdaq: [] as string[] };
const usExchanges = usData.exchanges ?? { nyse: [] as string[], nasdaq: [] as string[], amex: [] as string[] };

export const KRX_LISTED_CODES = new Set<string>(krxData.codes);
export const US_LISTED_TICKERS = new Set<string>(usData.tickers);

export const KRX_KOSPI_CODES = new Set<string>(krxBoards.kospi);
export const KRX_KOSDAQ_CODES = new Set<string>(krxBoards.kosdaq);

export const US_NYSE_TICKERS = new Set<string>(usExchanges.nyse);
export const US_NASDAQ_TICKERS = new Set<string>(usExchanges.nasdaq);
export const US_AMEX_TICKERS = new Set<string>(usExchanges.amex);

export function isKrxListedStock(stockCode?: string | null): boolean {
  const code = (stockCode ?? "").trim();
  return KRX_LISTED_CODES.has(code);
}

export function isUsListedTicker(stockCode?: string | null): boolean {
  const ticker = (stockCode ?? "").trim().toUpperCase();
  return ticker.length > 0 && US_LISTED_TICKERS.has(ticker);
}

export function inferKrxBoard(stockCode?: string | null): KrxBoard | null {
  const code = (stockCode ?? "").trim();
  if (KRX_KOSPI_CODES.has(code)) return "kospi";
  if (KRX_KOSDAQ_CODES.has(code)) return "kosdaq";
  return null;
}

export function inferUsExchange(ticker?: string | null): UsExchange | null {
  const symbol = (ticker ?? "").trim().toUpperCase();
  if (!symbol) return null;
  if (US_NYSE_TICKERS.has(symbol)) return "nyse";
  if (US_NASDAQ_TICKERS.has(symbol)) return "nasdaq";
  if (US_AMEX_TICKERS.has(symbol)) return "amex";
  return null;
}

/** ETF 보유 종목명·코드에서 미국 거래소 추정 (티커 심볼 해석 후 조회) */
export function inferUsExchangeForHolding(
  stockName?: string | null,
  stockCode?: string | null,
): UsExchange | null {
  const fromCode = inferUsExchange(stockCode);
  if (fromCode) return fromCode;
  const ticker = resolveStockTickerSymbol(stockName, stockCode);
  return ticker ? inferUsExchange(ticker) : null;
}
