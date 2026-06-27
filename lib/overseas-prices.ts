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

/** 장중 차트 기간 → Yahoo interval/range. 1일=5분봉, 1주=30분봉 */
export type IntradayPeriod = "1d" | "1w";

function intradayParams(period: IntradayPeriod): { interval: string; range: string } {
  return period === "1d"
    ? { interval: "5m", range: "1d" }
    : { interval: "30m", range: "5d" };
}

async function fetchYahooIntradayUncached(
  ticker: string,
  period: IntradayPeriod,
): Promise<StockPricePoint[]> {
  if (!ticker.trim()) return [];

  try {
    const { interval, range } = intradayParams(period);
    const url = `${YAHOO_CHART}/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 ETF-Tracker/1.0" },
      next: { revalidate: 300 },
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

    const points: StockPricePoint[] = [];
    for (let i = 0; i < timestamps.length; i += 1) {
      const close = closes[i];
      if (close == null || Number.isNaN(close)) continue;
      const ms = timestamps[i] * 1000;
      // 분 단위까지 구분되는 키 — localeCompare 정렬·중복 방지
      const date = new Date(ms).toISOString().slice(0, 16);
      points.push({ date, close, t: ms });
    }

    return points;
  } catch {
    return [];
  }
}

/** Yahoo Finance 장중 시계열 — 5분 캐시, 타임아웃 5초 */
export async function fetchYahooIntradayPrices(
  ticker: string,
  period: IntradayPeriod,
): Promise<StockPricePoint[]> {
  const normalized = ticker.trim();
  if (!normalized) return [];

  return unstable_cache(
    () => fetchYahooIntradayUncached(normalized, period),
    ["yahoo-intraday", normalized, period],
    { revalidate: 300 },
  )();
}

/** 해외 티커 장중 시계열 */
export async function fetchOverseasIntradayFromYahoo(
  stockCode: string,
  stockName: string | null | undefined,
  period: IntradayPeriod,
): Promise<StockPricePoint[]> {
  const ticker = resolveStockTickerSymbol(stockName, stockCode);
  if (!ticker) return [];
  return fetchYahooIntradayPrices(ticker, period);
}

/** KRX 6자리 코드 장중 시계열 (.KS / .KQ) */
export async function fetchKrxIntradayFromYahoo(
  stockCode: string,
  period: IntradayPeriod,
): Promise<StockPricePoint[]> {
  const code = stockCode.trim();
  if (!/^[0-9]{6}$/.test(code)) return [];

  for (const suffix of [".KS", ".KQ"]) {
    const points = await fetchYahooIntradayPrices(`${code}${suffix}`, period);
    if (points.length >= 2) return points;
  }
  return [];
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
