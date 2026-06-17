import type {
  EtfListItem,
  EtfMetaDaily,
  EtfUniverse,
  HoldingDaily,
  HoldingDiff,
  SignalDaily,
} from "@/lib/types";

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
    listing_date: "2023-08-22",
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

const DEMO_DIFFS: HoldingDiff[] = [
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
];

function applyEtfFilters(
  etfs: EtfUniverse[],
  filters?: { manager?: string; strategy?: string; market?: string; listedOnly?: boolean },
) {
  return etfs.filter((etf) => {
    if (filters?.manager && etf.manager !== filters.manager) return false;
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
  const etfs = DEMO_ETFS.filter((e) => e.manager === manager);
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

export function demoFetchManagers(): string[] {
  return [...new Set(DEMO_ETFS.map((e) => e.manager).filter(Boolean) as string[])].sort();
}
