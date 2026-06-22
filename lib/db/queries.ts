import { cache } from "react";
import type {
  ActiveMarketOverview,
  AssetClassFundFlowReport,
  DashboardData,
  EtfFlowLeader,
  EtfFlowSnapshot,
  EtfListItem,
  EtfMetaDaily,
  EtfNavPoint,
  EtfReturnRankItem,
  EtfShareMetaRow,
  ManagerFlowLeader,
  NewListingItem,
  OverseasStockRankItem,
  EtfUniverse,
  HoldingDaily,
  HoldingDiff,
  HoldingDiffEnriched,
  PopularStock,
  PriceRange,
  ReturnPeriod,
  SignalDaily,
  StockFlowSort,
  StockFlowSummary,
} from "@/lib/types";
import {
  ETF_ASSET_CLASS_LABELS,
  ETF_ASSET_CLASS_ORDER,
  inferEtfAssetClass,
} from "@/lib/etf-asset-class";
import { buildAssetClassFundFlowReport, DEFAULT_FUND_FLOW_WEEKS } from "@/lib/fund-flow";
import {
  computePeriodReturn,
  periodToDays,
  sortStockFlows,
} from "@/lib/rankings";
import { sanitizeNavSeries } from "@/lib/nav-series";
import { isTrackableStock, isEquityStock } from "@/lib/stock-filter";
import {
  buildDiffConsensusSignals,
  mergeSignalsWithDiffConsensus,
  type DiffWithStrategy,
} from "@/lib/signals-from-diff";
import { dedupeStockRefs, stockRefKey, type StockRef } from "@/lib/stock-ref";
import {
  buildManagerGroupMap,
  listManagerOptions,
  managerKey,
  resolveManagerVariants,
} from "@/lib/managers";
import { aggregateMovesByEtf } from "@/lib/manager-tags";
import { getSql } from "@/lib/db/client";
import { cutoffIsoDate, getLatestHoldingsDiffDate } from "@/lib/db/query-helpers";
import {
  demoFetchDashboard,
  demoFetchEtfDetail,
  demoFetchEtfList,
  demoFetchManagers,
  demoFetchManagerSummary,
  demoFetchPopularStocks,
  demoFetchSignals,
  demoFetchStockHoldings,
} from "@/lib/db/demo-data";
import { isDatabaseConfigured } from "@/lib/db/env";
import { normalizeIsoDate } from "@/lib/utils";

/** ETF 보유 공시는 전일자 기준으로 늦게 반영되므로, 최신 데이터일 기준 N일 창으로 집계 */
export const RECENT_CHANGE_WINDOW_DAYS = 3;

const RECENT_CHANGE_LOOKBACK_DAYS = RECENT_CHANGE_WINDOW_DAYS - 1;

/** 매매 흐름 diff 조회 상한 (기간 필터와 별도) */
const STOCK_FLOW_CHANGE_LIMIT = 1200;

/** NAV 수익률 순위 — sparkline 조회 ETF 풀 상한 */
const ETF_RETURN_RANK_POOL = 100;

/** UI에 내려보낼 운용사 태그 상한 (전체 move_count 집계는 유지) */
const STOCK_FLOW_MANAGER_TAGS = 12;

function compressFlowMovesForClient(flow: StockFlowSummary): StockFlowSummary {
  if (flow.moves.length <= STOCK_FLOW_MANAGER_TAGS) return flow;

  const aggregated = aggregateMovesByEtf(flow.moves).slice(0, STOCK_FLOW_MANAGER_TAGS);
  const sampleDate = flow.moves[0]?.date ?? "";

  return {
    ...flow,
    moves: aggregated.map((tag) => ({
      etf_ticker: tag.etfTicker,
      etf_name: tag.etfName,
      manager: tag.manager,
      change_type: tag.changeType,
      weight_delta: null,
      est_flow_krw: tag.flowKrw,
      date: sampleDate,
    })),
  };
}

async function loadManagerVariants(manager?: string): Promise<string[] | null> {
  if (!manager) return null;
  const sql = getSql();
  const rows = (await sql`
    SELECT DISTINCT manager FROM etf_universe WHERE manager IS NOT NULL
  `) as { manager: string }[];
  return resolveManagerVariants(
    buildManagerGroupMap(rows.map((r) => r.manager)),
    manager,
  );
}

function toIsoDate(value: unknown): string {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

function normalizeHolding(row: HoldingDaily): HoldingDaily {
  return {
    ...row,
    date: toIsoDate(row.date),
    weight: row.weight != null ? Number(row.weight) : null,
    quantity: row.quantity != null ? Number(row.quantity) : null,
  };
}

function normalizeDiff(row: HoldingDiff): HoldingDiff {
  return { ...row, date: toIsoDate(row.date) };
}

function enrichDiffRow(row: Record<string, unknown>): HoldingDiffEnriched {
  return {
    date: toIsoDate(row.date),
    etf_ticker: String(row.etf_ticker),
    stock_code: String(row.stock_code),
    stock_name: row.stock_name != null ? String(row.stock_name) : null,
    change_type: row.change_type as HoldingDiff["change_type"],
    weight_prev: row.weight_prev != null ? Number(row.weight_prev) : null,
    weight_curr: row.weight_curr != null ? Number(row.weight_curr) : null,
    weight_delta: row.weight_delta != null ? Number(row.weight_delta) : null,
    est_flow_krw: row.est_flow_krw != null ? Number(row.est_flow_krw) : null,
    etf_name: row.etf_name != null ? String(row.etf_name) : null,
    manager: row.manager != null ? String(row.manager) : null,
    strategy_type: row.strategy_type as EtfUniverse["strategy_type"],
    return_since_change: row.return_since_change != null ? Number(row.return_since_change) : null,
  };
}

function summarizeFlowStats(changes: HoldingDiffEnriched[]): {
  changeCount: number;
  accumulationFlow: number;
  distributionFlow: number;
} {
  const meaningful = changes.filter(
    (c) =>
      isTrackableStock(c.stock_code, c.stock_name) &&
      !(c.change_type === "new" && Math.abs(c.weight_delta ?? 0) < 0.001),
  );

  let accumulationFlow = 0;
  let distributionFlow = 0;
  for (const change of meaningful) {
    const flow = change.est_flow_krw ?? 0;
    if (flow > 0) accumulationFlow += flow;
    else if (flow < 0) distributionFlow += Math.abs(flow);
  }

  return {
    changeCount: meaningful.length,
    accumulationFlow,
    distributionFlow,
  };
}

async function fetchRecentChangesForStats(manager?: string): Promise<HoldingDiffEnriched[]> {
  const changes = await fetchStockFlowChangesLight(
    manager,
    5000,
    RECENT_CHANGE_LOOKBACK_DAYS,
  );
  if (!changes.length) return changes;
  const { aumByTicker, medianAum } = await fetchEtfAumContext(changes.map((c) => c.etf_ticker));
  return enrichChangesWithFlowEstimates(changes, aumByTicker, medianAum);
}

function isBuyChange(type: HoldingDiff["change_type"], flow: number | null) {
  if (type === "removed" || type === "weight_down") return false;
  if (type === "new" || type === "weight_up") return true;
  return (flow ?? 0) > 0;
}

function resolveEstFlowKrw(
  change: Pick<HoldingDiffEnriched, "est_flow_krw" | "weight_delta" | "etf_ticker">,
  aumByTicker: Map<string, number>,
  medianAum: number,
): number {
  if (change.est_flow_krw != null && change.est_flow_krw !== 0) return change.est_flow_krw;
  const delta = change.weight_delta;
  if (delta == null || delta === 0) return 0;
  const aum = aumByTicker.get(change.etf_ticker) ?? medianAum;
  return aum * (delta / 100);
}

async function fetchEtfAumContext(tickers: string[]): Promise<{
  aumByTicker: Map<string, number>;
  medianAum: number;
}> {
  const sql = getSql();
  const unique = [...new Set(tickers)];
  const aumRows = unique.length
    ? ((await sql`
        SELECT DISTINCT ON (etf_ticker) etf_ticker, aum::float AS aum
        FROM etf_meta_daily
        WHERE etf_ticker = ANY(${unique}) AND aum IS NOT NULL AND aum > 0
        ORDER BY etf_ticker, date DESC
      `) as { etf_ticker: string; aum: number }[])
    : [];
  const [medianRow] = unique.length
    ? ((await sql`
        SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY aum)::float AS median_aum
        FROM etf_meta_daily
        WHERE etf_ticker = ANY(${unique}) AND aum IS NOT NULL AND aum > 0
      `) as { median_aum: number | null }[])
    : [{ median_aum: null }];

  return {
    aumByTicker: new Map(aumRows.map((row) => [String(row.etf_ticker), Number(row.aum)])),
    medianAum: Number(medianRow?.median_aum ?? 50_000_000_000),
  };
}

function enrichChangesWithFlowEstimates(
  changes: HoldingDiffEnriched[],
  aumByTicker: Map<string, number>,
  medianAum: number,
): HoldingDiffEnriched[] {
  return changes.map((change) => {
    const resolved = resolveEstFlowKrw(change, aumByTicker, medianAum);
    if (change.est_flow_krw != null && change.est_flow_krw !== 0) return change;
    if (resolved === 0) return change;
    return { ...change, est_flow_krw: resolved };
  });
}

function groupStockFlows(changes: HoldingDiffEnriched[]): StockFlowSummary[] {
  const byStock = new Map<string, StockFlowSummary>();

  for (const change of changes) {
    if (!isTrackableStock(change.stock_code, change.stock_name)) continue;
    const key = change.stock_code;
    const flow = change.est_flow_krw ?? 0;
    const entry =
      byStock.get(key) ??
      ({
        stock_code: change.stock_code,
        stock_name: change.stock_name,
        move_count: 0,
        buy_count: 0,
        sell_count: 0,
        net_flow_krw: 0,
        gross_flow_krw: 0,
        buy_flow_krw: 0,
        sell_flow_krw: 0,
        price_return_pct: null,
        moves: [],
      } satisfies StockFlowSummary);

    entry.move_count += 1;
    entry.net_flow_krw += flow;
    entry.gross_flow_krw += Math.abs(flow);
    if (flow > 0) entry.buy_flow_krw += flow;
    else if (flow < 0) entry.sell_flow_krw += Math.abs(flow);

    if (isBuyChange(change.change_type, flow)) entry.buy_count += 1;
    else entry.sell_count += 1;

    entry.moves.push({
      etf_ticker: change.etf_ticker,
      etf_name: change.etf_name ?? change.etf_ticker,
      manager: change.manager ?? null,
      change_type: change.change_type,
      weight_delta: change.weight_delta,
      est_flow_krw: flow !== 0 ? flow : change.est_flow_krw,
      date: change.date,
    });

    if (!entry.stock_name && change.stock_name) entry.stock_name = change.stock_name;
    byStock.set(key, entry);
  }

  return [...byStock.values()];
}

async function enrichStockFlowsWithReturns(
  flows: StockFlowSummary[],
  period: ReturnPeriod,
): Promise<StockFlowSummary[]> {
  if (!flows.length) return flows;

  const codes = flows.map((f) => f.stock_code);
  const days = periodToDays(period) + 14;
  const priceMap = await fetchStockPriceSparklines(codes, days);

  return flows.map((flow) => ({
    ...flow,
    price_return_pct: computePeriodReturn(
      (priceMap[flow.stock_code] ?? []).map((p) => ({ date: p.date, value: p.close })),
      periodToDays(period),
    ),
  }));
}

export async function fetchRecentChangesEnriched(
  manager?: string,
  limit = 50,
  equitiesOnly = false,
): Promise<HoldingDiffEnriched[]> {
  if (!isDatabaseConfigured()) {
    const { demoFetchRecentChanges } = await import("@/lib/db/demo-data");
    const rows = demoFetchRecentChanges(manager, limit * 3);
    return equitiesOnly ? rows.filter((r) => isEquityStock(r.stock_code, r.stock_name)).slice(0, limit) : rows;
  }

  const sql = getSql();
  const managerVariants = await loadManagerVariants(manager);
  const latestDate = await getLatestHoldingsDiffDate(sql);
  const cutoffDate = latestDate ? cutoffIsoDate(latestDate, RECENT_CHANGE_LOOKBACK_DAYS) : null;
  const fetchLimit = equitiesOnly ? limit * 15 : limit;

  const changeRows = (await sql`
    SELECT
      d.*,
      u.name AS etf_name,
      u.manager,
      u.strategy_type,
      CASE
        WHEN p0.close IS NOT NULL AND p0.close > 0 AND p1.close IS NOT NULL
        THEN ((p1.close - p0.close) / p0.close * 100)
        ELSE NULL
      END AS return_since_change
    FROM holdings_diff d
    INNER JOIN etf_universe u ON u.ticker = d.etf_ticker
    LEFT JOIN prices_daily p0 ON p0.stock_code = d.stock_code AND p0.date = d.date
    LEFT JOIN LATERAL (
      SELECT close FROM prices_daily
      WHERE stock_code = d.stock_code
      ORDER BY date DESC
      LIMIT 1
    ) p1 ON TRUE
    WHERE u.strategy_type IN ('active', 'theme')
      AND (${cutoffDate}::date IS NULL OR d.date >= ${cutoffDate}::date)
      AND (${managerVariants}::text[] IS NULL OR u.manager = ANY(${managerVariants}))
    ORDER BY d.date DESC, ABS(d.weight_delta) DESC NULLS LAST
    LIMIT ${fetchLimit}
  `) as Record<string, unknown>[];

  let rows = changeRows.map(enrichDiffRow).filter((row) => isTrackableStock(row.stock_code, row.stock_name));
  if (equitiesOnly) {
    rows = rows.filter((row) => isEquityStock(row.stock_code, row.stock_name)).slice(0, limit);
  }
  const { aumByTicker, medianAum } = await fetchEtfAumContext(rows.map((r) => r.etf_ticker));
  return enrichChangesWithFlowEstimates(rows, aumByTicker, medianAum);
}

async function fetchStockFlowChangesLight(
  manager?: string,
  limit = STOCK_FLOW_CHANGE_LIMIT,
  lookbackDays = 30,
): Promise<HoldingDiffEnriched[]> {
  if (!isDatabaseConfigured()) {
    const { demoFetchRecentChanges } = await import("@/lib/db/demo-data");
    return demoFetchRecentChanges(manager, limit);
  }

  const sql = getSql();
  const managerVariants = await loadManagerVariants(manager);
  const latestDate = await getLatestHoldingsDiffDate(sql);
  const cutoffDate = latestDate ? cutoffIsoDate(latestDate, lookbackDays) : null;

  const changeRows = (await sql`
    SELECT
      d.*,
      u.name AS etf_name,
      u.manager,
      u.strategy_type,
      NULL::float AS return_since_change
    FROM holdings_diff d
    INNER JOIN etf_universe u ON u.ticker = d.etf_ticker
    WHERE u.strategy_type IN ('active', 'theme')
      AND (${cutoffDate}::date IS NULL OR d.date >= ${cutoffDate}::date)
      AND (${managerVariants}::text[] IS NULL OR u.manager = ANY(${managerVariants}))
      AND d.stock_code ~ '^[0-9]{6}$'
      AND d.stock_code <> '000000'
    ORDER BY d.date DESC, ABS(d.weight_delta) DESC NULLS LAST
    LIMIT ${limit}
  `) as Record<string, unknown>[];

  return changeRows.map(enrichDiffRow).filter((row) => isTrackableStock(row.stock_code, row.stock_name));
}

async function prepareStockFlowChanges(
  manager?: string,
  period: ReturnPeriod = "3m",
  limit = STOCK_FLOW_CHANGE_LIMIT,
): Promise<HoldingDiffEnriched[]> {
  const lookbackDays = periodToDays(period);
  const changes = await fetchStockFlowChangesLight(manager, limit, lookbackDays);
  if (!changes.length) return changes;
  const { aumByTicker, medianAum } = await fetchEtfAumContext(changes.map((c) => c.etf_ticker));
  return enrichChangesWithFlowEstimates(changes, aumByTicker, medianAum);
}

async function fetchStockFlowChangesEnriched(
  manager?: string,
  period: ReturnPeriod = "3m",
  limit = 2000,
): Promise<HoldingDiffEnriched[]> {
  return prepareStockFlowChanges(manager, period, limit);
}

export async function fetchStockFlows(
  manager?: string,
  limit = 15,
  sort: StockFlowSort = "turnover",
  period: ReturnPeriod = "3m",
): Promise<StockFlowSummary[]> {
  const changes = await prepareStockFlowChanges(manager, period);
  const flows = groupStockFlows(changes);
  const ranked = sortStockFlows(flows, sort).slice(0, limit);
  const enriched = await enrichStockFlowsWithReturns(ranked, period);
  return enriched.map(compressFlowMovesForClient);
}

export async function fetchStockFlowDataScope(): Promise<{
  trackedStocks: number;
  diffRows: number;
  hasSellEvents: boolean;
  krxConfigured: boolean;
}> {
  const krxConfigured = Boolean(process.env.KRX_ID?.trim() && process.env.KRX_PW?.trim());

  if (!isDatabaseConfigured()) {
    return { trackedStocks: 0, diffRows: 0, hasSellEvents: false, krxConfigured };
  }

  const sql = getSql();
  const [stats] = (await sql`
    WITH bounds AS (
      SELECT MAX(date) AS max_d FROM holdings_diff
    )
    SELECT
      COUNT(*)::int AS diff_rows,
      COUNT(DISTINCT d.stock_code) FILTER (
        WHERE d.stock_code ~ '^[0-9]{6}$' AND d.stock_code <> '000000'
      )::int AS tracked_stocks,
      COUNT(*) FILTER (
        WHERE d.change_type IN ('weight_down', 'removed') OR COALESCE(d.est_flow_krw, 0) < 0
      )::int AS sell_events
    FROM holdings_diff d
    CROSS JOIN bounds b
    WHERE b.max_d IS NOT NULL AND d.date >= b.max_d - INTERVAL '90 days'
  `) as { diff_rows: number; tracked_stocks: number; sell_events: number }[];

  return {
    diffRows: stats?.diff_rows ?? 0,
    trackedStocks: stats?.tracked_stocks ?? 0,
    hasSellEvents: (stats?.sell_events ?? 0) > 0,
    krxConfigured,
  };
}

export async function fetchEtfNavHistory(ticker: string, range: PriceRange = "1y"): Promise<EtfNavPoint[]> {
  if (!isDatabaseConfigured()) {
    const { demoFetchEtfNavHistory } = await import("@/lib/db/demo-data");
    return demoFetchEtfNavHistory(ticker, range);
  }

  const sql = getSql();
  const days = range === "1m" ? 30 : range === "3m" ? 90 : range === "1y" ? 365 : 9999;

  const rows =
    days >= 9999
      ? ((await sql`
          SELECT date, nav, aum FROM etf_meta_daily
          WHERE etf_ticker = ${ticker} AND nav IS NOT NULL
          ORDER BY date ASC
        `) as { date: unknown; nav: number; aum: number | null }[])
      : ((await sql`
          SELECT date, nav, aum FROM etf_meta_daily
          WHERE etf_ticker = ${ticker}
            AND nav IS NOT NULL
            AND date >= (CURRENT_DATE - ${days}::int)
          ORDER BY date ASC
        `) as { date: unknown; nav: number; aum: number | null }[]);

  return sanitizeNavSeries(
    rows.map((r) => ({
      date: toIsoDate(r.date),
      nav: Number(r.nav),
      aum: r.aum != null ? Number(r.aum) : null,
    })),
  );
}

export async function fetchEtfNavSparklines(
  tickers: string[],
  days = 90,
): Promise<Record<string, EtfNavPoint[]>> {
  const unique = [...new Set(tickers.filter(Boolean))];
  if (!unique.length) return {};

  if (!isDatabaseConfigured()) {
    const { demoFetchEtfNavSparklines } = await import("@/lib/db/demo-data");
    return demoFetchEtfNavSparklines(unique, days);
  }

  const sql = getSql();
  const rows = (await sql`
    SELECT etf_ticker, date, nav, aum
    FROM etf_meta_daily
    WHERE etf_ticker = ANY(${unique}::text[])
      AND nav IS NOT NULL
      AND date >= (CURRENT_DATE - ${days}::int)
    ORDER BY etf_ticker, date ASC
  `) as { etf_ticker: string; date: unknown; nav: number; aum: number | null }[];

  const map: Record<string, EtfNavPoint[]> = {};
  for (const row of rows) {
    if (!map[row.etf_ticker]) map[row.etf_ticker] = [];
    map[row.etf_ticker].push({
      date: toIsoDate(row.date),
      nav: Number(row.nav),
      aum: row.aum != null ? Number(row.aum) : null,
    });
  }
  for (const ticker of Object.keys(map)) {
    map[ticker] = sanitizeNavSeries(map[ticker]);
  }
  return map;
}

export async function fetchStockPriceHistory(
  stockCode: string,
  range: PriceRange = "1y",
  stockName?: string | null,
): Promise<import("@/lib/types").StockPricePoint[]> {
  if (!isDatabaseConfigured()) {
    const { demoFetchStockPriceHistory } = await import("@/lib/db/demo-data");
    return demoFetchStockPriceHistory(stockCode, range);
  }

  const sql = getSql();
  const days = range === "1m" ? 30 : range === "3m" ? 90 : range === "1y" ? 365 : 9999;

  const rows =
    days >= 9999
      ? ((await sql`
          SELECT date, close FROM prices_daily
          WHERE stock_code = ${stockCode} AND close IS NOT NULL
          ORDER BY date ASC
        `) as { date: unknown; close: number }[])
      : ((await sql`
          SELECT date, close FROM prices_daily
          WHERE stock_code = ${stockCode}
            AND close IS NOT NULL
            AND date >= (CURRENT_DATE - ${days}::int)
          ORDER BY date ASC
        `) as { date: unknown; close: number }[]);

  const points = rows.map((r) => ({
    date: toIsoDate(r.date),
    close: Number(r.close),
  }));

  if (points.length) return points;

  const { looksLikeOverseasStockName } = await import("@/lib/stock-ticker-resolve");
  if (!looksLikeOverseasStockName(stockName, stockCode)) return points;

  const { fetchOverseasPricesFromYahoo } = await import("@/lib/overseas-prices");
  const yahooDays = days >= 9999 ? 365 * 3 : days;
  return fetchOverseasPricesFromYahoo(stockCode, stockName, yahooDays);
}

export async function fetchStockPriceSparklines(
  stockCodes: string[],
  days = 90,
  nameByCode?: Record<string, string | null | undefined>,
): Promise<Record<string, import("@/lib/types").StockPricePoint[]>> {
  const unique = [...new Set(stockCodes.filter(Boolean))];
  if (!unique.length) return {};

  if (nameByCode) {
    const byRef = await fetchStockPriceSparklinesByRef(
      unique.map((code) => ({ stock_code: code, stock_name: nameByCode[code] ?? null })),
      days,
      { maxYahooFetches: 12 },
    );
    const map: Record<string, import("@/lib/types").StockPricePoint[]> = {};
    for (const code of unique) {
      const key = stockRefKey({ stock_code: code, stock_name: nameByCode[code] ?? null });
      map[code] = byRef[key] ?? byRef[code] ?? [];
    }
    return map;
  }

  if (!isDatabaseConfigured()) {
    const { demoFetchStockPriceSparklines } = await import("@/lib/db/demo-data");
    return demoFetchStockPriceSparklines(unique, days);
  }

  const sql = getSql();
  const rows = (await sql`
    SELECT stock_code, date, close
    FROM prices_daily
    WHERE stock_code = ANY(${unique}::text[])
      AND close IS NOT NULL
      AND date >= (CURRENT_DATE - ${days}::int)
    ORDER BY stock_code, date ASC
  `) as { stock_code: string; date: unknown; close: number }[];

  const map: Record<string, import("@/lib/types").StockPricePoint[]> = {};
  for (const row of rows) {
    if (!map[row.stock_code]) map[row.stock_code] = [];
    map[row.stock_code].push({
      date: toIsoDate(row.date),
      close: Number(row.close),
    });
  }

  return map;
}

const SPARKLINE_YAHOO_BATCH = 6;
const DEFAULT_MAX_YAHOO_SPARKLINE_FETCHES = 18;

type SparklineFetchOptions = {
  /** Yahoo API 호출 상한 — SSR 타임아웃 방지 */
  maxYahooFetches?: number;
};

async function runSparklineYahooBatch(
  refs: StockRef[],
  days: number,
  byCode: Record<string, import("@/lib/types").StockPricePoint[]>,
  out: Record<string, import("@/lib/types").StockPricePoint[]>,
): Promise<void> {
  const { looksLikeOverseasStockName } = await import("@/lib/stock-ticker-resolve");
  const { fetchKrxPricesFromYahoo, fetchOverseasPricesFromYahoo } = await import("@/lib/overseas-prices");

  for (let i = 0; i < refs.length; i += SPARKLINE_YAHOO_BATCH) {
    const batch = refs.slice(i, i + SPARKLINE_YAHOO_BATCH);
    await Promise.all(
      batch.map(async (ref) => {
        try {
          const key = stockRefKey(ref);
          if (out[key]?.length >= 2) return;

          const domestic = byCode[ref.stock_code] ?? [];
          const overseas = looksLikeOverseasStockName(ref.stock_name, ref.stock_code);

          if (overseas) {
            const points = await fetchOverseasPricesFromYahoo(ref.stock_code, ref.stock_name, days);
            out[key] = points.length >= 2 ? points : domestic;
            return;
          }

          const yahooDomestic = await fetchKrxPricesFromYahoo(ref.stock_code, days);
          out[key] = yahooDomestic.length >= 2 ? yahooDomestic : domestic;
        } catch {
          // Yahoo/네트워크 오류는 차트만 비움 — 페이지 전체 500 방지
        }
      }),
    );
  }
}

async function fetchStockPriceSparklinesByRefImpl(
  refs: StockRef[],
  days = 90,
  options: SparklineFetchOptions = {},
): Promise<Record<string, import("@/lib/types").StockPricePoint[]>> {
  const maxYahooFetches = options.maxYahooFetches ?? DEFAULT_MAX_YAHOO_SPARKLINE_FETCHES;
  const uniqueRefs = dedupeStockRefs(refs.filter((r) => r.stock_code));
  if (!uniqueRefs.length) return {};

  if (!isDatabaseConfigured()) {
    const { demoFetchStockPriceSparklines } = await import("@/lib/db/demo-data");
    const byCode = await demoFetchStockPriceSparklines(
      uniqueRefs.map((r) => r.stock_code),
      days,
    );
    const out: Record<string, import("@/lib/types").StockPricePoint[]> = {};
    for (const ref of uniqueRefs) {
      const key = stockRefKey(ref);
      out[key] = byCode[ref.stock_code] ?? [];
    }
    return out;
  }

  const codes = [...new Set(uniqueRefs.map((r) => r.stock_code))];
  const byCode: Record<string, import("@/lib/types").StockPricePoint[]> = {};

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT stock_code, date, close
      FROM prices_daily
      WHERE stock_code = ANY(${codes}::text[])
        AND close IS NOT NULL
        AND date >= (CURRENT_DATE - ${days}::int)
      ORDER BY stock_code, date ASC
    `) as { stock_code: string; date: unknown; close: number }[];

    for (const row of rows) {
      if (!byCode[row.stock_code]) byCode[row.stock_code] = [];
      byCode[row.stock_code].push({
        date: toIsoDate(row.date),
        close: Number(row.close),
      });
    }
  } catch {
    // DB 일시 장애 시 Yahoo fallback만 시도
  }

  const { looksLikeOverseasStockName } = await import("@/lib/stock-ticker-resolve");
  const out: Record<string, import("@/lib/types").StockPricePoint[]> = {};

  for (const ref of uniqueRefs) {
    const key = stockRefKey(ref);
    const domestic = byCode[ref.stock_code];
    const overseas = looksLikeOverseasStockName(ref.stock_name, ref.stock_code);
    if (domestic?.length && !overseas) {
      out[key] = domestic;
    }
  }

  const needsYahoo = uniqueRefs
    .filter((ref) => {
      const key = stockRefKey(ref);
      const overseas = looksLikeOverseasStockName(ref.stock_name, ref.stock_code);
      return overseas || !out[key]?.length;
    })
    .slice(0, maxYahooFetches);

  await runSparklineYahooBatch(needsYahoo, days, byCode, out);

  for (const ref of uniqueRefs) {
    const key = stockRefKey(ref);
    if (!out[key]) out[key] = byCode[ref.stock_code] ?? [];
  }

  return out;
}

/** code+name별 시세 (KRX 프록시 코드 재사용 시 종목명 기준 해외 시세 조회) */
export const fetchStockPriceSparklinesByRef = cache(fetchStockPriceSparklinesByRefImpl);

export async function fetchEtfNamesByTickers(
  tickers: string[],
): Promise<import("@/lib/types").EtfNameLookup> {
  if (!tickers.length) return {};
  if (!isDatabaseConfigured()) {
    const { demoFetchEtfNamesByTickers } = await import("@/lib/db/demo-data");
    return demoFetchEtfNamesByTickers(tickers);
  }

  const sql = getSql();
  const rows = (await sql`
    SELECT ticker, name, manager FROM etf_universe WHERE ticker = ANY(${tickers}::text[])
  `) as { ticker: string; name: string; manager: string | null }[];

  const out: import("@/lib/types").EtfNameLookup = {};
  for (const row of rows) {
    out[row.ticker] = { name: row.name, manager: row.manager };
  }
  return out;
}

function normalizeThemeTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value == null) return [];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const inner = trimmed.slice(1, -1);
      if (!inner) return [];
      return inner.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
    }
    return trimmed ? [trimmed] : [];
  }
  return [];
}

async function withDbQuery<T>(label: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[db:${label}]`, err);
    return fallback;
  }
}

function emptyDashboardData(): DashboardData {
  return {
    stats: {
      latestDate: null,
      earliestDate: null,
      windowDays: RECENT_CHANGE_WINDOW_DAYS,
      changeCount: 0,
      accumulationFlow: 0,
      distributionFlow: 0,
      signalCount: 0,
      activeEtfCount: 0,
    },
    recentChanges: [],
    topSignals: [],
  };
}

function emptyMarketOverview(): ActiveMarketOverview {
  return { totalAum: 0, etfCount: 0, asOfDate: null, slices: [] };
}

function asEtfUniverse(row: Record<string, unknown>): EtfUniverse {
  return {
    ticker: String(row.ticker),
    name: String(row.name),
    manager: row.manager != null ? String(row.manager) : null,
    market: row.market != null ? String(row.market) : null,
    strategy_type: row.strategy_type as EtfUniverse["strategy_type"],
    theme_tags: normalizeThemeTags(row.theme_tags),
    listing_date: normalizeIsoDate(row.listing_date),
    delist_date: normalizeIsoDate(row.delist_date),
    is_listed: Boolean(row.is_listed),
    crawl_enabled: Boolean(row.crawl_enabled),
  };
}

export async function fetchEtfList(
  filters?: {
    manager?: string;
    strategy?: string;
    market?: string;
    listedOnly?: boolean;
  },
  options?: { includeChangeCount?: boolean },
): Promise<EtfListItem[]> {
  if (!isDatabaseConfigured()) return demoFetchEtfList(filters);

  const sql = getSql();
  const managerVariants = await loadManagerVariants(filters?.manager);
  const strategy = filters?.strategy || null;
  const market = filters?.market || null;
  const listedOnly = filters?.listedOnly === true ? true : null;

  const rows = (await sql`
    SELECT * FROM etf_universe
    WHERE (${managerVariants}::text[] IS NULL OR manager = ANY(${managerVariants}))
      AND (${strategy}::text IS NULL OR strategy_type = ${strategy})
      AND (${market}::text IS NULL OR market = ${market})
      AND (${listedOnly}::bool IS NULL OR is_listed = ${listedOnly})
    ORDER BY name
  `) as Record<string, unknown>[];

  const etfs = rows.map(asEtfUniverse);
  if (!etfs.length) return [];

  const tickers = etfs.map((e) => e.ticker);
  const latestDiffDate = await getLatestHoldingsDiffDate(sql);
  const diffCutoff = latestDiffDate ? cutoffIsoDate(latestDiffDate, 90) : null;
  const metaRows = (await sql`
    SELECT DISTINCT ON (etf_ticker) etf_ticker, aum, date
    FROM etf_meta_daily
    WHERE etf_ticker = ANY(${tickers}::text[])
    ORDER BY etf_ticker, date DESC
  `) as { etf_ticker: string; aum: number | null; date: string }[];
  const latestAum = new Map<string, number | null>();
  for (const row of metaRows) {
    if (!latestAum.has(row.etf_ticker)) {
      latestAum.set(row.etf_ticker, row.aum);
    }
  }

  const includeChangeCount = options?.includeChangeCount !== false;
  const changeCount = new Map<string, number>();
  if (includeChangeCount) {
    const diffRows = diffCutoff
      ? ((await sql`
          SELECT etf_ticker, COUNT(*)::int AS cnt
          FROM holdings_diff
          WHERE etf_ticker = ANY(${tickers}::text[])
            AND date >= ${diffCutoff}::date
          GROUP BY etf_ticker
        `) as { etf_ticker: string; cnt: number }[])
      : [];
    for (const row of diffRows) {
      changeCount.set(row.etf_ticker, row.cnt);
    }
  }

  return etfs.map((etf) => ({
    ...etf,
    latest_aum: latestAum.get(etf.ticker) ?? null,
    change_count: changeCount.get(etf.ticker) ?? 0,
  }));
}

export async function fetchEtfDetail(ticker: string) {
  if (!isDatabaseConfigured()) return demoFetchEtfDetail(ticker);

  const sql = getSql();
  const etfRows = (await sql`
    SELECT * FROM etf_universe WHERE ticker = ${ticker} LIMIT 1
  `) as Record<string, unknown>[];
  const holdings = ((await sql`
    SELECT * FROM holdings_daily WHERE etf_ticker = ${ticker} ORDER BY date DESC LIMIT 200
  `) as HoldingDaily[]).map(normalizeHolding);
  const diffs = ((await sql`
    SELECT * FROM holdings_diff WHERE etf_ticker = ${ticker} ORDER BY date DESC LIMIT 100
  `) as HoldingDiff[]).map(normalizeDiff);
  const metaRows = (await sql`
    SELECT * FROM etf_meta_daily WHERE etf_ticker = ${ticker} ORDER BY date DESC LIMIT 1
  `) as EtfMetaDaily[];

  return {
    etf: etfRows[0] ? asEtfUniverse(etfRows[0]) : null,
    holdings,
    diffs,
    meta: metaRows[0] ?? null,
  };
}

export async function fetchManagerSummary(manager: string) {
  if (!isDatabaseConfigured()) return demoFetchManagerSummary(manager);

  const sql = getSql();
  const managerVariants = (await loadManagerVariants(manager)) ?? [manager];
  const etfRows = (await sql`
    SELECT * FROM etf_universe WHERE manager = ANY(${managerVariants}::text[]) ORDER BY name
  `) as Record<string, unknown>[];
  const etfs = etfRows.map(asEtfUniverse);
  const tickers = etfs.map((e) => e.ticker);

  const diffRows = tickers.length
    ? ((await sql`
        SELECT * FROM holdings_diff
        WHERE etf_ticker = ANY(${tickers}::text[])
        ORDER BY date DESC
        LIMIT 200
      `) as HoldingDiff[])
    : [];

  return { etfs, diffs: diffRows };
}

export async function fetchStockHoldings(stockCode: string) {
  if (!isDatabaseConfigured()) return demoFetchStockHoldings(stockCode);

  const sql = getSql();
  const holdings = ((await sql`
    SELECT DISTINCT ON (etf_ticker) *
    FROM holdings_daily
    WHERE stock_code = ${stockCode}
    ORDER BY etf_ticker, date DESC
  `) as HoldingDaily[]).map(normalizeHolding);
  const tickers = [...new Set(holdings.map((h) => h.etf_ticker))];

  const etfRows = tickers.length
    ? ((await sql`
        SELECT * FROM etf_universe WHERE ticker = ANY(${tickers}::text[])
      `) as Record<string, unknown>[])
    : [];

  const diffs = ((await sql`
    SELECT * FROM holdings_diff WHERE stock_code = ${stockCode} ORDER BY date DESC LIMIT 100
  `) as HoldingDiff[]).map(normalizeDiff);

  return {
    holdings,
    etfs: etfRows.map(asEtfUniverse),
    diffs,
  };
}

export async function fetchStockEtfWeightSeries(
  stockCode: string,
  days = 30,
): Promise<import("@/lib/types").EtfWeightSeries[]> {
  if (!isDatabaseConfigured()) {
    const { demoFetchStockEtfWeightSeries } = await import("@/lib/db/demo-data");
    return demoFetchStockEtfWeightSeries(stockCode, days);
  }

  const sql = getSql();
  const rows = (await sql`
    SELECT
      h.date,
      h.etf_ticker,
      u.name AS etf_name,
      h.weight::float AS weight
    FROM holdings_daily h
    INNER JOIN etf_universe u ON u.ticker = h.etf_ticker
    WHERE h.stock_code = ${stockCode}
      AND h.weight IS NOT NULL
      AND h.date >= (
        SELECT COALESCE(MAX(date), CURRENT_DATE) - ${days}::int
        FROM holdings_daily
        WHERE stock_code = ${stockCode}
      )
    ORDER BY h.date ASC, h.etf_ticker ASC
  `) as { date: unknown; etf_ticker: string; etf_name: string | null; weight: number }[];

  const byEtf = new Map<string, { etfName: string | null; points: { date: string; weight: number }[] }>();
  for (const row of rows) {
    const date = toIsoDate(row.date);
    const entry = byEtf.get(row.etf_ticker) ?? { etfName: row.etf_name, points: [] };
    if (!entry.etfName && row.etf_name) entry.etfName = row.etf_name;
    entry.points.push({ date, weight: Number(row.weight) });
    byEtf.set(row.etf_ticker, entry);
  }

  return [...byEtf.entries()].map(([etfTicker, { etfName, points }]) => ({
    etfTicker,
    etfName,
    points: points.sort((a, b) => a.date.localeCompare(b.date)),
  }));
}

/** @deprecated fetchStockEtfWeightSeries 사용 */
export async function fetchStockManagerWeightSeries(
  stockCode: string,
  days = 30,
): Promise<import("@/lib/types").ManagerWeightSeries[]> {
  if (!isDatabaseConfigured()) {
    const { demoFetchStockManagerWeightSeries } = await import("@/lib/db/demo-data");
    return demoFetchStockManagerWeightSeries(stockCode);
  }

  const sql = getSql();
  const rows = (await sql`
    SELECT
      h.date,
      u.manager,
      SUM(h.weight)::float AS weight
    FROM holdings_daily h
    INNER JOIN etf_universe u ON u.ticker = h.etf_ticker
    WHERE h.stock_code = ${stockCode}
      AND u.manager IS NOT NULL
      AND h.weight IS NOT NULL
      AND h.date >= (
        SELECT COALESCE(MAX(date), CURRENT_DATE) - ${days}::int
        FROM holdings_daily
        WHERE stock_code = ${stockCode}
      )
    GROUP BY h.date, u.manager
    ORDER BY h.date ASC, u.manager ASC
  `) as { date: unknown; manager: string; weight: number }[];

  const byManager = new Map<string, { date: string; weight: number }[]>();
  for (const row of rows) {
    const canonical = managerKey(row.manager) || row.manager;
    const date = toIsoDate(row.date);
    const list = byManager.get(canonical) ?? [];
    const existing = list.find((point) => point.date === date);
    if (existing) {
      existing.weight += Number(row.weight);
    } else {
      list.push({ date, weight: Number(row.weight) });
    }
    byManager.set(canonical, list);
  }

  const series = [...byManager.entries()].map(([manager, points]) => ({
    manager,
    points: points.sort((a, b) => a.date.localeCompare(b.date)),
  }));
  return series;
}

export async function fetchStockSignals(stockCode: string, limit = 50): Promise<SignalDaily[]> {
  if (!isDatabaseConfigured()) {
    const { demoFetchSignals } = await import("@/lib/db/demo-data");
    return demoFetchSignals(limit).filter((s) => s.stock_code === stockCode);
  }

  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM signals_daily
    WHERE stock_code = ${stockCode}
    ORDER BY date DESC
    LIMIT ${limit}
  `) as SignalDaily[];

  return rows.map((row) => ({ ...row, date: toIsoDate(row.date) }));
}

export async function fetchSignalsFiltered(filters?: {
  manager?: string;
  direction?: string;
  windowDays?: number;
  query?: string;
  limit?: number;
}): Promise<SignalDaily[]> {
  if (!isDatabaseConfigured()) {
    const { demoFetchSignalsFiltered } = await import("@/lib/db/demo-data");
    return demoFetchSignalsFiltered(filters);
  }

  const sql = getSql();
  const managerVariants = await loadManagerVariants(filters?.manager);
  const direction = filters?.direction && filters.direction !== "all" ? filters.direction : null;
  const windowDays = filters?.windowDays ?? null;
  const query = filters?.query?.trim() ? `%${filters.query.trim()}%` : null;
  const limit = filters?.limit ?? 100;

  const [storedRows, diffRows, managerRows] = (await Promise.all([
    sql`
      SELECT s.*
      FROM signals_daily s
      ORDER BY s.date DESC, s.score DESC NULLS LAST
      LIMIT ${Math.max(limit * 4, 400)}
    `,
    sql`
      SELECT
        d.date,
        d.etf_ticker,
        d.stock_code,
        d.stock_name,
        d.change_type,
        d.weight_prev,
        d.weight_curr,
        d.weight_delta,
        d.est_flow_krw,
        u.strategy_type
      FROM holdings_diff d
      INNER JOIN etf_universe u ON u.ticker = d.etf_ticker
      WHERE u.strategy_type IN ('active', 'theme')
        AND d.change_type IN ('weight_up', 'weight_down', 'removed')
        AND d.date >= (CURRENT_DATE - INTERVAL '90 days')
    `,
    sql`
      SELECT ticker, manager FROM etf_universe WHERE manager IS NOT NULL
    `,
  ])) as [SignalDaily[], DiffWithStrategy[], { ticker: string; manager: string }[]];

  const managerByTicker = new Map(managerRows.map((row) => [row.ticker, row.manager]));

  let rows = mergeSignalsWithDiffConsensus(
    storedRows.map((row) => ({ ...row, date: toIsoDate(row.date) })),
    buildDiffConsensusSignals(
      diffRows.map((row) => ({
        ...row,
        date: toIsoDate(row.date),
        weight_prev: row.weight_prev != null ? Number(row.weight_prev) : null,
        weight_curr: row.weight_curr != null ? Number(row.weight_curr) : null,
        weight_delta: row.weight_delta != null ? Number(row.weight_delta) : null,
        est_flow_krw: row.est_flow_krw != null ? Number(row.est_flow_krw) : null,
      })),
    ),
  );

  if (direction) {
    rows = rows.filter((row) => row.direction === direction);
  }
  if (windowDays != null) {
    rows = rows.filter((row) => row.window_days <= windowDays);
  }
  if (query) {
    const q = query.slice(1, -1).toLowerCase();
    rows = rows.filter(
      (row) =>
        row.stock_name?.toLowerCase().includes(q) ||
        row.stock_code.toLowerCase().includes(q),
    );
  }
  if (managerVariants) {
    rows = rows.filter((row) =>
      row.etf_tickers.some((ticker) => {
        const manager = managerByTicker.get(ticker);
        return manager != null && managerVariants.includes(manager);
      }),
    );
  }

  return rows
    .filter((row) => isTrackableStock(row.stock_code, row.stock_name))
    .slice(0, limit);
}

export async function fetchSignals(limit = 100): Promise<SignalDaily[]> {
  return fetchSignalsFiltered({ limit });
}

export async function fetchManagers(): Promise<string[]> {
  if (!isDatabaseConfigured()) return demoFetchManagers();

  const sql = getSql();
  const rows = (await sql`
    SELECT DISTINCT manager FROM etf_universe WHERE manager IS NOT NULL
  `) as { manager: string }[];
  return listManagerOptions(buildManagerGroupMap(rows.map((r) => r.manager)));
}

export async function fetchPopularStocks(limit = 50): Promise<PopularStock[]> {
  if (!isDatabaseConfigured()) return demoFetchPopularStocks(limit);

  const sql = getSql();
  const rows = (await sql`
    WITH latest AS (
      SELECT etf_ticker, MAX(date) AS date
      FROM holdings_daily
      GROUP BY etf_ticker
    ),
    snapshot AS (
      SELECT h.stock_code, h.stock_name, h.etf_ticker, h.weight
      FROM holdings_daily h
      INNER JOIN latest l ON h.etf_ticker = l.etf_ticker AND h.date = l.date
      INNER JOIN etf_universe u ON u.ticker = h.etf_ticker
    )
    SELECT
      stock_code,
      MAX(stock_name) AS stock_name,
      COUNT(DISTINCT etf_ticker)::int AS etf_count,
      AVG(weight) FILTER (WHERE weight > 0) AS avg_weight,
      MAX(weight) FILTER (WHERE weight > 0) AS max_weight
    FROM snapshot
    GROUP BY stock_code
    ORDER BY etf_count DESC, avg_weight DESC NULLS LAST
    LIMIT ${limit}
  `) as PopularStock[];

  return rows
    .map((row) => ({
      ...row,
      etf_count: Number(row.etf_count),
      avg_weight: row.avg_weight != null ? Number(row.avg_weight) : null,
      max_weight: row.max_weight != null ? Number(row.max_weight) : null,
    }))
    .filter((row) => isTrackableStock(row.stock_code, row.stock_name));
}

export async function fetchDashboard(manager?: string): Promise<DashboardData> {
  if (!isDatabaseConfigured()) return demoFetchDashboard(manager);

  return withDbQuery("fetchDashboard", emptyDashboardData(), async () => {
  const sql = getSql();
  const managerVariants = await loadManagerVariants(manager);
  const latestDate = await getLatestHoldingsDiffDate(sql);
  const cutoffDate = latestDate ? cutoffIsoDate(latestDate, RECENT_CHANGE_LOOKBACK_DAYS) : null;

  const dateRows = cutoffDate
    ? ((await sql`
        SELECT
          TO_CHAR(MAX(d.date), 'YYYY-MM-DD') AS latest_date,
          TO_CHAR(MIN(d.date), 'YYYY-MM-DD') AS earliest_date
        FROM holdings_diff d
        INNER JOIN etf_universe u ON u.ticker = d.etf_ticker
        WHERE u.strategy_type IN ('active', 'theme')
          AND d.date >= ${cutoffDate}::date
          AND (${managerVariants}::text[] IS NULL OR u.manager = ANY(${managerVariants}))
      `) as { latest_date: string | null; earliest_date: string | null }[])
    : [{ latest_date: null, earliest_date: null }];
  const latestDateStr = dateRows[0]?.latest_date ? toIsoDate(dateRows[0].latest_date) : null;
  const earliestDate = dateRows[0]?.earliest_date ? toIsoDate(dateRows[0].earliest_date) : null;

  const recentChanges = await fetchRecentChangesEnriched(manager, 20, true);
  const flowStats = summarizeFlowStats(await fetchRecentChangesForStats(manager));

  const signalRows = (await sql`
    SELECT COUNT(*)::int AS cnt FROM signals_daily
    WHERE date >= (CURRENT_DATE - INTERVAL '7 days')
  `) as { cnt: number }[];

  const activeRows = (await sql`
    SELECT COUNT(*)::int AS cnt FROM etf_universe
    WHERE strategy_type = 'active' AND is_listed = TRUE AND crawl_enabled = TRUE
      AND (${managerVariants}::text[] IS NULL OR manager = ANY(${managerVariants}))
  `) as { cnt: number }[];

  const topSignals = await fetchSignals(8);

  return {
    stats: {
      latestDate: latestDateStr,
      earliestDate,
      windowDays: RECENT_CHANGE_WINDOW_DAYS,
      changeCount: flowStats.changeCount,
      accumulationFlow: flowStats.accumulationFlow,
      distributionFlow: flowStats.distributionFlow,
      signalCount: signalRows[0]?.cnt ?? 0,
      activeEtfCount: activeRows[0]?.cnt ?? 0,
    },
    recentChanges,
    topSignals,
  };
  });
}

export async function fetchOverseasStockRankings(
  period: ReturnPeriod = "3m",
  poolLimit = 60,
  listLimit = 8,
): Promise<{ gainers: OverseasStockRankItem[]; losers: OverseasStockRankItem[] }> {
  if (!isDatabaseConfigured()) {
    return { gainers: [], losers: [] };
  }

  const sql = getSql();
  const rows = (await sql`
    SELECT DISTINCT stock_code, stock_name
    FROM holdings_daily
    WHERE date = (SELECT MAX(date) FROM holdings_daily)
      AND stock_name ~ '[A-Z]{4,}'
      AND stock_code ~ '^[0-9]{6}$'
      AND stock_code <> '000000'
    LIMIT ${poolLimit}
  `) as { stock_code: string; stock_name: string | null }[];

  if (!rows.length) return { gainers: [], losers: [] };

  const codes = rows.map((r) => r.stock_code);
  const nameByCode = new Map(rows.map((r) => [r.stock_code, r.stock_name]));
  const priceMap = await fetchStockPriceSparklines(codes, periodToDays(period) + 14);

  const ranked = codes
    .map((code) => ({
      stock_code: code,
      stock_name: nameByCode.get(code) ?? null,
      price_return_pct: computePeriodReturn(
        (priceMap[code] ?? []).map((p) => ({ date: p.date, value: p.close })),
        periodToDays(period),
      ),
    }))
    .filter((row) => row.price_return_pct != null) as OverseasStockRankItem[];

  const gainers = [...ranked]
    .sort((a, b) => (b.price_return_pct ?? 0) - (a.price_return_pct ?? 0))
    .slice(0, listLimit);
  const losers = [...ranked]
    .sort((a, b) => (a.price_return_pct ?? 0) - (b.price_return_pct ?? 0))
    .slice(0, listLimit);

  return { gainers, losers };
}

export async function fetchEtfReturnRankings(
  filters?: {
    manager?: string;
    strategy?: string;
    market?: string;
    listedOnly?: boolean;
  },
  period: ReturnPeriod = "3m",
  limit = 50,
): Promise<EtfReturnRankItem[]> {
  const etfs = await fetchEtfList(filters, { includeChangeCount: false });
  if (!etfs.length) return [];

  const pool =
    etfs.length > ETF_RETURN_RANK_POOL
      ? [...etfs].sort((a, b) => (b.latest_aum ?? 0) - (a.latest_aum ?? 0)).slice(0, ETF_RETURN_RANK_POOL)
      : etfs;

  const tickers = pool.map((e) => e.ticker);
  const days = periodToDays(period) + 14;
  const navMap = await fetchEtfNavSparklines(tickers, days);

  const ranked = pool
    .map((etf) => {
      const series = sanitizeNavSeries(navMap[etf.ticker] ?? []);
      const navReturn = computePeriodReturn(
        series.map((p) => ({ date: p.date, value: p.nav })),
        periodToDays(period),
      );
      const latestNav = series.length ? series[series.length - 1].nav : null;

      return {
        ticker: etf.ticker,
        name: etf.name,
        manager: etf.manager,
        strategy_type: etf.strategy_type,
        market: etf.market,
        latest_aum: etf.latest_aum ?? null,
        latest_nav: latestNav,
        nav_return_pct: navReturn,
        change_count: etf.change_count,
      } satisfies EtfReturnRankItem;
    })
    .filter((row) => row.nav_return_pct != null)
    .sort((a, b) => (b.nav_return_pct ?? 0) - (a.nav_return_pct ?? 0))
    .slice(0, limit);

  return ranked;
}

const NEW_LISTING_LOOKBACK_DAYS = 90;
const ETF_FLOW_WINDOW_DAYS = 7;

function buildMarketOverview(
  rows: { name: string; aum: number | null; date: string | null }[],
): ActiveMarketOverview {
  const byClass = new Map<string, { count: number; aum: number }>();
  let totalAum = 0;
  let asOfDate: string | null = null;

  for (const row of rows) {
    const cls = inferEtfAssetClass(row.name);
    const aum = row.aum ?? 0;
    totalAum += aum;
    const prev = byClass.get(cls) ?? { count: 0, aum: 0 };
    byClass.set(cls, { count: prev.count + 1, aum: prev.aum + aum });
    if (row.date && (!asOfDate || row.date > asOfDate)) asOfDate = row.date;
  }

  const slices = ETF_ASSET_CLASS_ORDER.map((assetClass) => {
    const bucket = byClass.get(assetClass) ?? { count: 0, aum: 0 };
    return {
      assetClass,
      label: ETF_ASSET_CLASS_LABELS[assetClass],
      count: bucket.count,
      aum: bucket.aum,
      sharePct: totalAum > 0 ? (bucket.aum / totalAum) * 100 : 0,
    };
  }).filter((s) => s.count > 0);

  return {
    totalAum,
    etfCount: rows.length,
    asOfDate,
    slices,
  };
}

export async function fetchActiveMarketOverview(manager?: string): Promise<ActiveMarketOverview> {
  if (!isDatabaseConfigured()) {
    const { demoFetchActiveMarketOverview } = await import("@/lib/db/demo-data");
    return demoFetchActiveMarketOverview(manager);
  }

  return withDbQuery("fetchActiveMarketOverview", emptyMarketOverview(), async () => {
  const sql = getSql();
  const managerVariants = await loadManagerVariants(manager);

  const rows = (await sql`
    SELECT u.name, m.aum::float AS aum, TO_CHAR(m.date, 'YYYY-MM-DD') AS date
    FROM etf_universe u
    LEFT JOIN LATERAL (
      SELECT aum, date FROM etf_meta_daily
      WHERE etf_ticker = u.ticker AND aum IS NOT NULL AND aum > 0
      ORDER BY date DESC
      LIMIT 1
    ) m ON TRUE
    WHERE u.strategy_type IN ('active', 'theme')
      AND u.is_listed = TRUE
      AND u.crawl_enabled = TRUE
      AND (${managerVariants}::text[] IS NULL OR u.manager = ANY(${managerVariants}))
    ORDER BY u.name
  `) as { name: string; aum: number | null; date: string | null }[];

  return buildMarketOverview(
    rows.map((r) => ({
      name: r.name,
      aum: r.aum != null ? Number(r.aum) : null,
      date: r.date,
    })),
  );
  });
}

export async function fetchNewListings(days = NEW_LISTING_LOOKBACK_DAYS): Promise<{
  items: NewListingItem[];
  days: number;
}> {
  if (!isDatabaseConfigured()) {
    const { demoFetchNewListings } = await import("@/lib/db/demo-data");
    return demoFetchNewListings(days);
  }

  return withDbQuery("fetchNewListings", { items: [], days }, async () => {
  const sql = getSql();

  const rows = (await sql`
    SELECT
      u.ticker,
      u.name,
      u.manager,
      u.market,
      u.strategy_type,
      u.theme_tags,
      TO_CHAR(u.listing_date, 'YYYY-MM-DD') AS listing_date,
      TO_CHAR(u.delist_date, 'YYYY-MM-DD') AS delist_date,
      u.is_listed,
      u.crawl_enabled,
      m.aum::float AS latest_aum
    FROM etf_universe u
    LEFT JOIN LATERAL (
      SELECT aum FROM etf_meta_daily
      WHERE etf_ticker = u.ticker AND aum IS NOT NULL
      ORDER BY date DESC
      LIMIT 1
    ) m ON TRUE
    WHERE u.listing_date IS NOT NULL
      AND u.listing_date >= (CURRENT_DATE - ${days}::int)
      AND u.is_listed = TRUE
      AND u.strategy_type IN ('active', 'theme')
    ORDER BY u.listing_date DESC, u.name
  `) as (Record<string, unknown> & { latest_aum: number | null })[];

  const items: NewListingItem[] = rows.map((row) => {
    const etf = asEtfUniverse(row);
    return {
      ...etf,
      latest_aum: row.latest_aum != null ? Number(row.latest_aum) : null,
      asset_class: inferEtfAssetClass(etf.name),
    };
  });

  return { items, days };
  });
}

function aggregateEtfFlows(changes: HoldingDiffEnriched[]): EtfFlowLeader[] {
  const byEtf = new Map<string, EtfFlowLeader>();

  for (const change of changes) {
    const flow = change.est_flow_krw ?? 0;
    const prev =
      byEtf.get(change.etf_ticker) ??
      ({
        ticker: change.etf_ticker,
        name: change.etf_name ?? change.etf_ticker,
        manager: change.manager ?? null,
        net_flow_krw: 0,
        move_count: 0,
        asset_class: inferEtfAssetClass(change.etf_name),
      } satisfies EtfFlowLeader);

    prev.net_flow_krw += flow;
    prev.move_count += 1;
    if (change.etf_name) prev.name = change.etf_name;
    byEtf.set(change.etf_ticker, prev);
  }

  return [...byEtf.values()];
}

function aggregateManagerFlows(leaders: EtfFlowLeader[]): {
  inflow: ManagerFlowLeader[];
  outflow: ManagerFlowLeader[];
} {
  const byManager = new Map<string, { net: number; etfs: Set<string> }>();

  for (const row of leaders) {
    if (!row.manager) continue;
    const prev = byManager.get(row.manager) ?? { net: 0, etfs: new Set<string>() };
    prev.net += row.net_flow_krw;
    prev.etfs.add(row.ticker);
    byManager.set(row.manager, prev);
  }

  const all: ManagerFlowLeader[] = [...byManager.entries()].map(([manager, v]) => ({
    manager,
    net_flow_krw: v.net,
    etf_count: v.etfs.size,
  }));

  return {
    inflow: all.filter((m) => m.net_flow_krw > 0).sort((a, b) => b.net_flow_krw - a.net_flow_krw),
    outflow: all
      .filter((m) => m.net_flow_krw < 0)
      .sort((a, b) => a.net_flow_krw - b.net_flow_krw),
  };
}

export async function fetchEtfFlowSnapshot(
  manager?: string,
  windowDays = ETF_FLOW_WINDOW_DAYS,
  limit = 10,
): Promise<EtfFlowSnapshot> {
  if (!isDatabaseConfigured()) {
    const { demoFetchEtfFlowSnapshot } = await import("@/lib/db/demo-data");
    return demoFetchEtfFlowSnapshot(manager, windowDays, limit);
  }

  return withDbQuery(
    "fetchEtfFlowSnapshot",
    {
      windowDays,
      totalInflow: 0,
      totalOutflow: 0,
      topInflow: [],
      topOutflow: [],
      topManagerInflow: [],
      topManagerOutflow: [],
    },
    async () => {
  const changes = await fetchStockFlowChangesLight(manager, 2000, windowDays);
  const { aumByTicker, medianAum } = await fetchEtfAumContext(changes.map((c) => c.etf_ticker));
  const enriched = enrichChangesWithFlowEstimates(changes, aumByTicker, medianAum);
  const leaders = aggregateEtfFlows(enriched);

  let totalInflow = 0;
  let totalOutflow = 0;
  for (const row of leaders) {
    if (row.net_flow_krw > 0) totalInflow += row.net_flow_krw;
    else if (row.net_flow_krw < 0) totalOutflow += Math.abs(row.net_flow_krw);
  }

  const topInflow = leaders
    .filter((r) => r.net_flow_krw > 0)
    .sort((a, b) => b.net_flow_krw - a.net_flow_krw)
    .slice(0, limit);
  const topOutflow = leaders
    .filter((r) => r.net_flow_krw < 0)
    .sort((a, b) => a.net_flow_krw - b.net_flow_krw)
    .slice(0, limit);

  const mgr = aggregateManagerFlows(leaders);

  return {
    windowDays,
    totalInflow,
    totalOutflow,
    topInflow,
    topOutflow,
    topManagerInflow: mgr.inflow.slice(0, limit),
    topManagerOutflow: mgr.outflow.slice(0, limit),
  };
  },
  );
}

const FUND_FLOW_LOOKBACK_DAYS = 100;

export async function fetchAssetClassFundFlows(
  manager?: string,
  weeks = DEFAULT_FUND_FLOW_WEEKS,
): Promise<AssetClassFundFlowReport> {
  if (!isDatabaseConfigured()) {
    const { demoFetchAssetClassFundFlows } = await import("@/lib/db/demo-data");
    return demoFetchAssetClassFundFlows(manager, weeks);
  }

  return withDbQuery(
    "fetchAssetClassFundFlows",
    buildAssetClassFundFlowReport([], weeks),
    async () => {
  const sql = getSql();
  const managerVariants = await loadManagerVariants(manager);

  const metaRows = (await sql`
    SELECT
      u.ticker,
      u.name,
      u.manager,
      TO_CHAR(m.date, 'YYYY-MM-DD') AS date,
      m.nav::float AS nav,
      m.listed_shares::bigint AS listed_shares,
      m.aum::float AS aum
    FROM etf_universe u
    INNER JOIN etf_meta_daily m ON m.etf_ticker = u.ticker
    WHERE u.strategy_type IN ('active', 'theme')
      AND u.is_listed = TRUE
      AND u.crawl_enabled = TRUE
      AND m.date >= (CURRENT_DATE - ${FUND_FLOW_LOOKBACK_DAYS}::int)
      AND m.nav IS NOT NULL
      AND m.nav > 0
      AND (${managerVariants}::text[] IS NULL OR u.manager = ANY(${managerVariants}))
    ORDER BY u.ticker, m.date
  `) as {
    ticker: string;
    name: string;
    manager: string | null;
    date: string;
    nav: number | null;
    listed_shares: number | null;
    aum: number | null;
  }[];

  const byTicker = new Map<
    string,
    { ticker: string; name: string; manager: string | null; rows: EtfShareMetaRow[] }
  >();

  for (const row of metaRows) {
    const prev =
      byTicker.get(row.ticker) ??
      ({
        ticker: row.ticker,
        name: row.name,
        manager: row.manager,
        rows: [],
      } satisfies { ticker: string; name: string; manager: string | null; rows: EtfShareMetaRow[] });
    prev.rows.push({
      date: row.date,
      nav: row.nav,
      listed_shares: row.listed_shares != null ? Number(row.listed_shares) : null,
      aum: row.aum,
    });
    byTicker.set(row.ticker, prev);
  }

  return buildAssetClassFundFlowReport([...byTicker.values()], weeks);
  },
  );
}
