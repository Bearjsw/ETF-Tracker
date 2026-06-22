import {
  ETF_ASSET_CLASS_LABELS,
  ETF_ASSET_CLASS_ORDER,
  inferEtfAssetClass,
} from "@/lib/etf-asset-class";
import { buildManagerGroupMap, listManagerOptions, matchesManagerFilter } from "@/lib/managers";
import {
  buildDiffConsensusSignals,
  mergeSignalsWithDiffConsensus,
} from "@/lib/signals-from-diff";
import type {
  ActiveMarketOverview,
  AssetClassFundFlowReport,
  EtfFlowSnapshot,
  EtfListItem,
  EtfMetaDaily,
  EtfShareMetaRow,
  EtfUniverse,
  HoldingDaily,
  HoldingDiff,
  NewListingItem,
  SignalDaily,
} from "@/lib/types";
import { buildAssetClassFundFlowReport, DEFAULT_FUND_FLOW_WEEKS } from "@/lib/fund-flow";

const DEMO_DATE = "2026-06-16";

const DEMO_ETFS: EtfUniverse[] = [
  {
    ticker: "385720",
    name: "KBSTAR 액티브 KOSPI",
    manager: "KB자산운용",
    market: "KOSPI",
    strategy_type: "active",
    theme_tags: [],
    listing_date: "2021-03-15",
    delist_date: null,
    is_listed: true,
    crawl_enabled: true,
  },
  {
    ticker: "292150",
    name: "TIGER 코스닥150액티브",
    manager: "미래에셋자산운용",
    market: "KOSDAQ",
    strategy_type: "active",
    theme_tags: [],
    listing_date: "2019-11-07",
    delist_date: null,
    is_listed: true,
    crawl_enabled: true,
  },
  {
    ticker: "463250",
    name: "TIGER 미국AI빅테크10",
    manager: "미래에셋자산운용",
    market: "KOSPI",
    strategy_type: "theme",
    theme_tags: ["AI", "빅테크"],
    listing_date: "2026-06-09",
    delist_date: null,
    is_listed: true,
    crawl_enabled: true,
  },
  {
    ticker: "069500",
    name: "KODEX 200",
    manager: "삼성자산운용",
    market: "KOSPI",
    strategy_type: "passive",
    theme_tags: [],
    listing_date: "2002-10-14",
    delist_date: null,
    is_listed: true,
    crawl_enabled: false,
  },
];

const DEMO_HOLDINGS: HoldingDaily[] = [
  { date: DEMO_DATE, etf_ticker: "385720", stock_code: "005930", stock_name: "삼성전자", weight: 8.2, quantity: 120000 },
  { date: DEMO_DATE, etf_ticker: "385720", stock_code: "000660", stock_name: "SK하이닉스", weight: 6.5, quantity: 45000 },
  { date: DEMO_DATE, etf_ticker: "292150", stock_code: "035420", stock_name: "NAVER", weight: 5.1, quantity: 18000 },
  { date: DEMO_DATE, etf_ticker: "463250", stock_code: "NVDA", stock_name: "NVIDIA", weight: 12.4, quantity: 9000 },
];

const DEMO_DIFFS: (HoldingDiff & { return_since_change?: number })[] = [
  {
    date: DEMO_DATE,
    etf_ticker: "385720",
    stock_code: "005930",
    stock_name: "삼성전자",
    change_type: "weight_up",
    weight_prev: 7.8,
    weight_curr: 8.2,
    weight_delta: 0.4,
    est_flow_krw: 1200000000,
    return_since_change: 2.34,
  },
  {
    date: DEMO_DATE,
    etf_ticker: "292150",
    stock_code: "035420",
    stock_name: "NAVER",
    change_type: "new",
    weight_prev: null,
    weight_curr: 5.1,
    weight_delta: 5.1,
    est_flow_krw: 800000000,
    return_since_change: 4.12,
  },
  {
    date: DEMO_DATE,
    etf_ticker: "463250",
    stock_code: "NVDA",
    stock_name: "NVIDIA",
    change_type: "weight_up",
    weight_prev: 11.2,
    weight_curr: 12.4,
    weight_delta: 1.2,
    est_flow_krw: 2500000000,
    return_since_change: 6.78,
  },
  {
    date: "2026-06-15",
    etf_ticker: "385720",
    stock_code: "000660",
    stock_name: "SK하이닉스",
    change_type: "weight_down",
    weight_prev: 7.1,
    weight_curr: 6.5,
    weight_delta: -0.6,
    est_flow_krw: -980000000,
    return_since_change: -1.25,
  },
  {
    date: "2026-06-15",
    etf_ticker: "292150",
    stock_code: "000660",
    stock_name: "SK하이닉스",
    change_type: "weight_down",
    weight_prev: 5.8,
    weight_curr: 5.2,
    weight_delta: -0.6,
    est_flow_krw: -720000000,
    return_since_change: -1.25,
  },
  {
    date: DEMO_DATE,
    etf_ticker: "292150",
    stock_code: "005930",
    stock_name: "삼성전자",
    change_type: "weight_up",
    weight_prev: 4.2,
    weight_curr: 4.8,
    weight_delta: 0.6,
    est_flow_krw: 650000000,
    return_since_change: 1.8,
  },
];

const DEMO_META: EtfMetaDaily[] = [
  { date: DEMO_DATE, etf_ticker: "385720", aum: 850000000000, nav: 12500, listed_shares: 68000000 },
  { date: DEMO_DATE, etf_ticker: "292150", aum: 320000000000, nav: 9800, listed_shares: 32653000 },
  { date: DEMO_DATE, etf_ticker: "463250", aum: 1200000000000, nav: 15200, listed_shares: 78947000 },
];

const DEMO_SIGNALS: SignalDaily[] = [
  {
    date: DEMO_DATE,
    stock_code: "005930",
    stock_name: "삼성전자",
    signal_type: "consensus",
    direction: "accumulation",
    window_days: 5,
    etf_count: 3,
    etf_tickers: ["385720", "292150", "069500"],
    score: 0.82,
    strength: "high",
  },
  {
    date: DEMO_DATE,
    stock_code: "035420",
    stock_name: "NAVER",
    signal_type: "new_entry",
    direction: "accumulation",
    window_days: 1,
    etf_count: 2,
    etf_tickers: ["292150", "385720"],
    score: 0.65,
    strength: "medium",
  },
  {
    date: "2026-06-15",
    stock_code: "000660",
    stock_name: "SK하이닉스",
    signal_type: "consensus",
    direction: "distribution",
    window_days: 5,
    etf_count: 3,
    etf_tickers: ["385720", "292150", "463250"],
    score: 0.71,
    strength: "medium",
  },
];

function applyEtfFilters(
  etfs: EtfUniverse[],
  filters?: { manager?: string; strategy?: string; market?: string; listedOnly?: boolean },
) {
  return etfs.filter((etf) => {
    if (filters?.manager && !matchesManagerFilter(etf.manager, filters.manager)) return false;
    if (filters?.strategy && etf.strategy_type !== filters.strategy) return false;
    if (filters?.market && etf.market !== filters.market) return false;
    if (filters?.listedOnly && !etf.is_listed) return false;
    return true;
  });
}

export function demoFetchEtfList(filters?: {
  manager?: string;
  strategy?: string;
  market?: string;
  listedOnly?: boolean;
}): EtfListItem[] {
  const etfs = applyEtfFilters(DEMO_ETFS, filters);
  return etfs.map((etf) => ({
    ...etf,
    latest_aum: DEMO_META.find((m) => m.etf_ticker === etf.ticker)?.aum ?? null,
    change_count: DEMO_DIFFS.filter((d) => d.etf_ticker === etf.ticker).length,
  }));
}

export function demoFetchEtfDetail(ticker: string) {
  return {
    etf: DEMO_ETFS.find((e) => e.ticker === ticker) ?? null,
    holdings: DEMO_HOLDINGS.filter((h) => h.etf_ticker === ticker),
    diffs: DEMO_DIFFS.filter((d) => d.etf_ticker === ticker),
    meta: DEMO_META.find((m) => m.etf_ticker === ticker) ?? null,
  };
}

export function demoFetchManagerSummary(manager: string) {
  const etfs = DEMO_ETFS.filter((e) => matchesManagerFilter(e.manager, manager));
  const tickers = new Set(etfs.map((e) => e.ticker));
  return {
    etfs,
    diffs: DEMO_DIFFS.filter((d) => tickers.has(d.etf_ticker)),
  };
}

export function demoFetchStockHoldings(stockCode: string) {
  const holdings = DEMO_HOLDINGS.filter((h) => h.stock_code === stockCode);
  const tickers = [...new Set(holdings.map((h) => h.etf_ticker))];
  return {
    holdings,
    etfs: DEMO_ETFS.filter((e) => tickers.includes(e.ticker)),
    diffs: DEMO_DIFFS.filter((d) => d.stock_code === stockCode),
  };
}

export function demoFetchSignals(limit = 100): SignalDaily[] {
  return DEMO_SIGNALS.slice(0, limit);
}

export function demoFetchSignalsFiltered(filters?: {
  manager?: string;
  direction?: string;
  windowDays?: number;
  query?: string;
  limit?: number;
}): SignalDaily[] {
  const etfByTicker = new Map(DEMO_ETFS.map((etf) => [etf.ticker, etf]));
  const diffWithStrategy = DEMO_DIFFS.map((row) => ({
    ...row,
    strategy_type: etfByTicker.get(row.etf_ticker)?.strategy_type ?? null,
  }));

  let rows = mergeSignalsWithDiffConsensus(DEMO_SIGNALS, buildDiffConsensusSignals(diffWithStrategy));

  if (filters?.manager) {
    rows = rows.filter((s) =>
      s.etf_tickers.some((t) =>
        matchesManagerFilter(DEMO_ETFS.find((e) => e.ticker === t)?.manager, filters.manager),
      ),
    );
  }
  if (filters?.direction && filters.direction !== "all") {
    rows = rows.filter((s) => s.direction === filters.direction);
  }
  if (filters?.windowDays) {
    rows = rows.filter((s) => s.window_days <= filters.windowDays!);
  }
  if (filters?.query) {
    const q = filters.query.toLowerCase();
    rows = rows.filter(
      (s) => s.stock_name?.toLowerCase().includes(q) || s.stock_code.includes(q),
    );
  }
  return rows.slice(0, filters?.limit ?? 100);
}

export function demoFetchStockEtfWeightSeries(
  stockCode: string,
  days = 30,
): import("@/lib/types").EtfWeightSeries[] {
  const etfByTicker = new Map(DEMO_ETFS.map((e) => [e.ticker, e]));
  const etfBase = new Map<string, { name: string | null; weight: number }>();

  for (const row of DEMO_HOLDINGS.filter((h) => h.stock_code === stockCode)) {
    const etf = etfByTicker.get(row.etf_ticker);
    const prev = etfBase.get(row.etf_ticker);
    etfBase.set(row.etf_ticker, {
      name: etf?.name ?? prev?.name ?? null,
      weight: (prev?.weight ?? 0) + (row.weight ?? 0),
    });
  }

  if (!etfBase.size) {
    const fallbacks = DEMO_ETFS.slice(0, 3);
    for (const etf of fallbacks) {
      etfBase.set(etf.ticker, { name: etf.name, weight: 3 + Math.random() * 4 });
    }
  }

  const seed = Number.parseInt(stockCode.replace(/\D/g, "").slice(-4) || "1", 10);
  return [...etfBase.entries()].map(([etfTicker, { name, weight: base }], idx) => {
    const points: { date: string; weight: number }[] = [];
    for (let i = days; i >= 0; i--) {
      const d = new Date("2026-06-17T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - i);
      const wave = Math.sin((i + seed + idx * 7) / 14) * 0.8;
      const ramp = idx === 2 ? ((days - i) / 10) * 1.5 : 0;
      points.push({
        date: d.toISOString().slice(0, 10),
        weight: Math.max(0, Number((base + wave + ramp).toFixed(2))),
      });
    }
    return { etfTicker, etfName: name, points };
  });
}

/** @deprecated demoFetchStockEtfWeightSeries 사용 */
export function demoFetchStockManagerWeightSeries(stockCode: string): import("@/lib/types").ManagerWeightSeries[] {
  const etfByTicker = new Map(DEMO_ETFS.map((e) => [e.ticker, e]));
  const managerBase = new Map<string, number>();

  for (const row of DEMO_HOLDINGS.filter((h) => h.stock_code === stockCode)) {
    const manager = etfByTicker.get(row.etf_ticker)?.manager;
    if (!manager) continue;
    managerBase.set(manager, (managerBase.get(manager) ?? 0) + (row.weight ?? 0));
  }

  if (!managerBase.size) {
    managerBase.set("삼성자산운용", 6.5);
    managerBase.set("미래에셋자산운용", 4.2);
    managerBase.set("KB자산운용", 2.8);
  }

  const seed = Number.parseInt(stockCode.replace(/\D/g, "").slice(-4) || "1", 10);
  return [...managerBase.entries()].map(([manager, base], idx) => {
    const points: { date: string; weight: number }[] = [];
    for (let i = 120; i >= 0; i--) {
      const d = new Date("2026-06-17T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - i);
      const wave = Math.sin((i + seed + idx * 7) / 14) * 1.2;
      const ramp = manager.includes("타임") || idx === 2 ? ((120 - i) / 40) * 3 : 0;
      points.push({
        date: d.toISOString().slice(0, 10),
        weight: Math.max(0, Number((base + wave + ramp).toFixed(2))),
      });
    }
    return { manager, points };
  });
}

export function demoFetchManagers(): string[] {
  return listManagerOptions(buildManagerGroupMap(DEMO_ETFS.map((e) => e.manager).filter(Boolean) as string[]));
}

export function demoFetchPopularStocks(limit = 50): import("@/lib/types").PopularStock[] {
  const byStock = new Map<string, { name: string | null; weights: number[]; etfs: Set<string> }>();
  for (const row of DEMO_HOLDINGS) {
    const entry = byStock.get(row.stock_code) ?? { name: row.stock_name, weights: [], etfs: new Set() };
    entry.weights.push(row.weight ?? 0);
    entry.etfs.add(row.etf_ticker);
    byStock.set(row.stock_code, entry);
  }
  return [...byStock.entries()]
    .map(([stock_code, data]) => ({
      stock_code,
      stock_name: data.name,
      etf_count: data.etfs.size,
      avg_weight: data.weights.reduce((a, b) => a + b, 0) / data.weights.length,
      max_weight: Math.max(...data.weights),
    }))
    .sort((a, b) => b.etf_count - a.etf_count || (b.avg_weight ?? 0) - (a.avg_weight ?? 0))
    .slice(0, limit);
}

export function demoFetchRecentChanges(manager?: string, limit = 50): import("@/lib/types").HoldingDiffEnriched[] {
  const latest = DEMO_DIFFS.reduce((max, d) => (d.date > max ? d.date : max), DEMO_DIFFS[0]?.date ?? DEMO_DATE);
  const cutoff = new Date(`${latest}T00:00:00`);
  cutoff.setDate(cutoff.getDate() - 2);

  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return DEMO_DIFFS.map((diff) => {
    const etf = DEMO_ETFS.find((e) => e.ticker === diff.etf_ticker);
    return {
      ...diff,
      etf_name: etf?.name ?? null,
      manager: etf?.manager ?? null,
      strategy_type: etf?.strategy_type ?? null,
      return_since_change: diff.return_since_change ?? null,
    };
  })
    .filter((d) => d.date >= cutoffStr)
    .filter((d) => !manager || matchesManagerFilter(d.manager, manager))
    .sort((a, b) => Math.abs(b.weight_delta ?? 0) - Math.abs(a.weight_delta ?? 0))
    .slice(0, limit);
}

export function demoFetchEtfNamesByTickers(tickers: string[]) {
  const out: import("@/lib/types").EtfNameLookup = {};
  for (const ticker of tickers) {
    const etf = DEMO_ETFS.find((e) => e.ticker === ticker);
    if (etf) out[ticker] = { name: etf.name, manager: etf.manager };
  }
  return out;
}

function buildDemoNavSeries(ticker: string): import("@/lib/types").EtfNavPoint[] {
  const meta = DEMO_META.find((m) => m.etf_ticker === ticker);
  const baseNav = meta?.nav ?? 10000;
  const points: import("@/lib/types").EtfNavPoint[] = [];
  for (let i = 365; i >= 0; i--) {
    const d = new Date("2026-06-17T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - i);
    const wave = Math.sin(i / 18) * 0.04 + ((365 - i) / 365) * 0.12;
    points.push({
      date: d.toISOString().slice(0, 10),
      nav: Math.round(baseNav * (1 + wave)),
      aum: meta?.aum ?? null,
    });
  }
  return points;
}

export function demoFetchEtfNavHistory(ticker: string, range: import("@/lib/types").PriceRange = "1y") {
  const all = buildDemoNavSeries(ticker);
  const days = range === "1m" ? 30 : range === "3m" ? 90 : range === "1y" ? 365 : 9999;
  if (days >= 9999) return all;
  const cutoff = all[all.length - 1]?.date;
  if (!cutoff) return all;
  const end = new Date(cutoff);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const startStr = start.toISOString().slice(0, 10);
  return all.filter((p) => p.date >= startStr);
}

export function demoFetchEtfNavSparklines(tickers: string[], days = 90) {
  const range: import("@/lib/types").PriceRange = days <= 30 ? "1m" : days <= 90 ? "3m" : "1y";
  const result: Record<string, import("@/lib/types").EtfNavPoint[]> = {};
  for (const ticker of tickers) {
    result[ticker] = demoFetchEtfNavHistory(ticker, range);
  }
  return result;
}

function buildDemoStockSeries(stockCode: string): import("@/lib/types").StockPricePoint[] {
  const seed = Number.parseInt(stockCode.replace(/\D/g, "").slice(-6) || "0", 10) || 42;
  const base = 20_000 + (seed % 180_000);
  const points: import("@/lib/types").StockPricePoint[] = [];
  for (let i = 365; i >= 0; i--) {
    const d = new Date("2026-06-17T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - i);
    const wave = Math.sin((i + seed) / 14) * 0.05 + ((365 - i) / 365) * 0.08;
    points.push({
      date: d.toISOString().slice(0, 10),
      close: Math.round(base * (1 + wave)),
    });
  }
  return points;
}

export function demoFetchStockPriceHistory(
  stockCode: string,
  range: import("@/lib/types").PriceRange = "1y",
) {
  const all = buildDemoStockSeries(stockCode);
  const days = range === "1m" ? 30 : range === "3m" ? 90 : range === "1y" ? 365 : 9999;
  if (days >= 9999) return all;
  const cutoff = all[all.length - 1]?.date;
  if (!cutoff) return all;
  const end = new Date(cutoff);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const startStr = start.toISOString().slice(0, 10);
  return all.filter((p) => p.date >= startStr);
}

export function demoFetchStockPriceSparklines(stockCodes: string[], days = 90) {
  const range: import("@/lib/types").PriceRange = days <= 30 ? "1m" : days <= 90 ? "3m" : "1y";
  const result: Record<string, import("@/lib/types").StockPricePoint[]> = {};
  for (const code of stockCodes) {
    result[code] = demoFetchStockPriceHistory(code, range);
  }
  return result;
}

export function demoFetchDashboard(manager?: string): import("@/lib/types").DashboardData {
  const activeEtfs = DEMO_ETFS.filter(
    (e) =>
      (e.strategy_type === "active" || e.strategy_type === "theme") &&
      (!manager || matchesManagerFilter(e.manager, manager)),
  );
  const recentChanges = demoFetchRecentChanges(manager, 25);
  const windowDiffs = recentChanges;
  const latestDate = windowDiffs.reduce<string | null>(
    (max, d) => (!max || d.date > max ? d.date : max),
    null,
  );
  const earliestDate = windowDiffs.reduce<string | null>(
    (min, d) => (!min || d.date < min ? d.date : min),
    null,
  );

  return {
    stats: {
      latestDate,
      earliestDate,
      windowDays: 3,
      changeCount: windowDiffs.length,
      accumulationFlow: windowDiffs.filter((d) => (d.est_flow_krw ?? 0) > 0).reduce((s, d) => s + (d.est_flow_krw ?? 0), 0),
      distributionFlow: windowDiffs.filter((d) => (d.est_flow_krw ?? 0) < 0).reduce((s, d) => s + Math.abs(d.est_flow_krw ?? 0), 0),
      signalCount: DEMO_SIGNALS.length,
      activeEtfCount: activeEtfs.filter((e) => e.crawl_enabled).length,
    },
    recentChanges,
    topSignals: DEMO_SIGNALS,
  };
}

export function demoFetchActiveMarketOverview(manager?: string): ActiveMarketOverview {
  const etfs = DEMO_ETFS.filter(
    (e) =>
      (e.strategy_type === "active" || e.strategy_type === "theme") &&
      e.crawl_enabled &&
      (!manager || matchesManagerFilter(e.manager, manager)),
  );
  const aumByTicker = new Map(DEMO_META.map((m) => [m.etf_ticker, m.aum]));
  const totalAum = etfs.reduce((s, e) => s + (aumByTicker.get(e.ticker) ?? 0), 0);
  const byClass = new Map<string, { count: number; aum: number }>();

  for (const etf of etfs) {
    const cls = inferEtfAssetClass(etf.name);
    const aum = aumByTicker.get(etf.ticker) ?? 0;
    const prev = byClass.get(cls) ?? { count: 0, aum: 0 };
    byClass.set(cls, { count: prev.count + 1, aum: prev.aum + aum });
  }

  return {
    totalAum,
    etfCount: etfs.length,
    asOfDate: DEMO_DATE,
    slices: ETF_ASSET_CLASS_ORDER.filter((c) => byClass.has(c)).map((assetClass) => {
      const bucket = byClass.get(assetClass)!;
      return {
        assetClass,
        label: ETF_ASSET_CLASS_LABELS[assetClass],
        count: bucket.count,
        aum: bucket.aum,
        sharePct: totalAum > 0 ? (bucket.aum / totalAum) * 100 : 0,
      };
    }),
  };
}

export function demoFetchNewListings(days: number): { items: NewListingItem[]; days: number } {
  const cutoff = new Date(DEMO_DATE);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const aumByTicker = new Map(DEMO_META.map((m) => [m.etf_ticker, m.aum]));

  const items = DEMO_ETFS.filter(
    (e) =>
      (e.strategy_type === "active" || e.strategy_type === "theme") &&
      e.listing_date &&
      e.listing_date >= cutoffStr,
  ).map((etf) => ({
    ...etf,
    latest_aum: aumByTicker.get(etf.ticker) ?? null,
    asset_class: inferEtfAssetClass(etf.name),
  }));

  return { items, days };
}

export function demoFetchEtfFlowSnapshot(
  manager?: string,
  windowDays = 7,
  limit = 10,
): EtfFlowSnapshot {
  const changes = demoFetchRecentChanges(manager, 200);
  const byEtf = new Map<string, import("@/lib/types").EtfFlowLeader>();

  for (const change of changes) {
    const etf = DEMO_ETFS.find((e) => e.ticker === change.etf_ticker);
    if (!etf) continue;
    const flow = change.est_flow_krw ?? 0;
    const prev =
      byEtf.get(change.etf_ticker) ??
      ({
        ticker: change.etf_ticker,
        name: etf.name,
        manager: etf.manager,
        net_flow_krw: 0,
        move_count: 0,
        asset_class: inferEtfAssetClass(etf.name),
      } satisfies import("@/lib/types").EtfFlowLeader);
    prev.net_flow_krw += flow;
    prev.move_count += 1;
    byEtf.set(change.etf_ticker, prev);
  }

  const leaders = [...byEtf.values()];
  let totalInflow = 0;
  let totalOutflow = 0;
  for (const row of leaders) {
    if (row.net_flow_krw > 0) totalInflow += row.net_flow_krw;
    else totalOutflow += Math.abs(row.net_flow_krw);
  }

  return {
    windowDays,
    totalInflow,
    totalOutflow,
    topInflow: leaders
      .filter((r) => r.net_flow_krw > 0)
      .sort((a, b) => b.net_flow_krw - a.net_flow_krw)
      .slice(0, limit),
    topOutflow: leaders
      .filter((r) => r.net_flow_krw < 0)
      .sort((a, b) => a.net_flow_krw - b.net_flow_krw)
      .slice(0, limit),
    topManagerInflow: [],
    topManagerOutflow: [],
  };
}

/** 12주 데모용 meta 시계열 — Δ좌수×NAV 차트 개발용 */
function buildDemoShareMetaSeries(): Map<string, EtfShareMetaRow[]> {
  const base = new Map(DEMO_META.map((m) => [m.etf_ticker, m]));
  const end = new Date(`${DEMO_DATE}T12:00:00`);
  const series = new Map<string, EtfShareMetaRow[]>();

  const flowPatterns: Record<string, number[]> = {
    "385720": [0, 1.2, 0.8, -0.5, 1.5, 0.3, -1.0, 2.0, 0.6, -0.8, 1.1, 0.4, -0.6, 1.3],
    "292150": [0, -0.6, 0.4, 1.0, -0.3, 0.9, 0.2, -1.2, 0.5, 0.7, -0.4, 0.8, 1.1, -0.5],
    "463250": [0, 2.5, 1.8, 3.0, -2.0, 1.2, 2.8, -1.5, 4.0, 1.0, -0.6, 2.2, -1.8, 1.6],
  };

  const weekCount = 14;

  for (const etf of DEMO_ETFS.filter((e) => e.crawl_enabled && (e.strategy_type === "active" || e.strategy_type === "theme"))) {
    const meta = base.get(etf.ticker);
    if (!meta?.nav || !meta.listed_shares) continue;

    const pattern = flowPatterns[etf.ticker] ?? flowPatterns["385720"];
    const rows: EtfShareMetaRow[] = [];
    let shares = meta.listed_shares;
    const nav = meta.nav;

    for (let w = weekCount - 1; w >= 0; w -= 1) {
      const d = new Date(end);
      d.setDate(d.getDate() - w * 7);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${day}`;
      if (w < weekCount - 1) {
        const pct = (pattern[weekCount - 1 - w] ?? pattern[pattern.length - 1] ?? 0) / 100;
        shares = Math.round(shares * (1 + pct));
      }
      rows.push({
        date: dateStr,
        nav,
        listed_shares: shares,
        aum: Math.round(shares * nav),
      });
    }
    series.set(etf.ticker, rows);
  }

  return series;
}

export function demoFetchAssetClassFundFlows(
  manager?: string,
  weeks = DEFAULT_FUND_FLOW_WEEKS,
): AssetClassFundFlowReport {
  const etfs = DEMO_ETFS.filter(
    (e) =>
      (e.strategy_type === "active" || e.strategy_type === "theme") &&
      e.crawl_enabled &&
      (!manager || matchesManagerFilter(e.manager, manager)),
  );
  const metaSeries = buildDemoShareMetaSeries();

  return buildAssetClassFundFlowReport(
    etfs
      .filter((e) => metaSeries.has(e.ticker))
      .map((e) => ({
        ticker: e.ticker,
        name: e.name,
        manager: e.manager,
        rows: metaSeries.get(e.ticker)!,
      })),
    weeks,
  );
}
