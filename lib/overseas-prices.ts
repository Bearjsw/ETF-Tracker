import { unstable_cache } from "next/cache";
import { resolveStockTickerSymbol } from "@/lib/stock-ticker-resolve";
import type { StockPricePoint } from "@/lib/types";

const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";
const YAHOO_FETCH_TIMEOUT_MS = 5_000;

function rangeParam(days: number): string {
  if (days <= 30) return "1mo";
  if (days <= 90) return "3mo";
  if (days <= 180) return "6mo";
  if (days <= 365) return "1y";
  return "5y";
}

async function fetchYahooChartPricesUncached(ticker: string, days: number): Promise<StockPricePoint[]> {
  if (!ticker.trim()) return [];

  try {
    const url = `${YAHOO_CHART}/${encodeURIComponent(ticker)}?interval=1d&range=${rangeParam(days)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 ETF-Tracker/1.0" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(YAHOO_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return [];

    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: { quote?: Array<{ close?: Array<number | null> }> };
        }>;
      };
    };

    const result = json.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    if (!timestamps.length) return [];

    const cutoff = Date.now() - days * 86_400_000;
    const points: StockPricePoint[] = [];

    for (let i = 0; i < timestamps.length; i += 1) {
      const close = closes[i];
      if (close == null || Number.isNaN(close)) continue;
      const ms = timestamps[i] * 1000;
      if (ms < cutoff) continue;
      const date = new Date(ms).toISOString().slice(0, 10);
      points.push({ date, close });
    }

    return points;
  } catch {
    return [];
  }
}

/** Yahoo Finance chart API — 1시간 캐시, 타임아웃 5초 */
export async function fetchYahooChartPrices(ticker: string, days = 365): Promise<StockPricePoint[]> {
  const normalized = ticker.trim();
  if (!normalized) return [];

  return unstable_cache(
    () => fetchYahooChartPricesUncached(normalized, days),
    ["yahoo-chart", normalized, String(days)],
    { revalidate: 3600 },
  )();
}

/** DB에 없을 때 해외 티커 Yahoo Finance 차트 API로 종가 시계열 조회 */
export async function fetchOverseasPricesFromYahoo(
  stockCode: string,
  stockName: string | null | undefined,
  days = 365,
): Promise<StockPricePoint[]> {
  const ticker = resolveStockTickerSymbol(stockName, stockCode);
  if (!ticker) return [];
  return fetchYahooChartPrices(ticker, days);
}

/** KRX 6자리 코드 — DB 미수집 국내주 Yahoo (.KS / .KQ) */
export async function fetchKrxPricesFromYahoo(stockCode: string, days = 90): Promise<StockPricePoint[]> {
  const code = stockCode.trim();
  if (!/^[0-9]{6}$/.test(code)) return [];

  for (const suffix of [".KS", ".KQ"]) {
    const points = await fetchYahooChartPrices(`${code}${suffix}`, days);
    if (points.length >= 2) return points;
  }
  return [];
}
