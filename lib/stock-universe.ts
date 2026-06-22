import krxData from "@/data/krx_listed_codes.json";
import usData from "@/data/us_listed_tickers.json";

/** KRX KIND 상장종목 (FinanceDataReader KOSPI+KOSDAQ, gen_stock_universe_maps.py) */
export const KRX_LISTED_UPDATED: string = krxData.updated;

/** NYSE+NASDAQ+AMEX (FinanceDataReader, gen_stock_universe_maps.py) */
export const US_LISTED_UPDATED: string = usData.updated;

export const KRX_LISTED_CODES = new Set<string>(krxData.codes);
export const US_LISTED_TICKERS = new Set<string>(usData.tickers);

export function isKrxListedStock(stockCode?: string | null): boolean {
  const code = (stockCode ?? "").trim();
  return KRX_LISTED_CODES.has(code);
}

export function isUsListedTicker(stockCode?: string | null): boolean {
  const ticker = (stockCode ?? "").trim().toUpperCase();
  return ticker.length > 0 && US_LISTED_TICKERS.has(ticker);
}
