import type { EtfAssetClassId } from "@/lib/etf-asset-class";

export type StrategyType = "active" | "passive" | "theme";

export type EtfUniverse = {
  ticker: string;
  name: string;
  manager: string | null;
  market: string | null;
  strategy_type: StrategyType;
  theme_tags: string[];
  listing_date: string | null;
  delist_date: string | null;
  is_listed: boolean;
  crawl_enabled: boolean;
};

export type HoldingDaily = {
  date: string;
  etf_ticker: string;
  stock_code: string;
  stock_name: string | null;
  weight: number | null;
  quantity: number | null;
};

export type HoldingDiff = {
  date: string;
  etf_ticker: string;
  stock_code: string;
  stock_name: string | null;
  change_type: "new" | "removed" | "weight_up" | "weight_down";
  weight_prev: number | null;
  weight_curr: number | null;
  weight_delta: number | null;
  est_flow_krw: number | null;
};

export type EtfMetaDaily = {
  date: string;
  etf_ticker: string;
  aum: number | null;
  nav: number | null;
  listed_shares: number | null;
};

export type SignalDaily = {
  date: string;
  stock_code: string;
  stock_name: string | null;
  signal_type: "new_entry" | "consensus" | "weight_surge" | "convergence";
  direction: "accumulation" | "distribution";
  window_days: number;
  etf_count: number;
  etf_tickers: string[];
  score: number | null;
  strength: string | null;
};

export type PopularStock = {
  stock_code: string;
  stock_name: string | null;
  etf_count: number;
  avg_weight: number | null;
  max_weight: number | null;
  /** 최근 1달 주가 수익률 (주식 종목) */
  price_return_pct?: number | null;
};

export type EtfListItem = EtfUniverse & {
  latest_aum?: number | null;
  change_count?: number;
  recent_delta_sum?: number | null;
};

export type HoldingDiffEnriched = HoldingDiff & {
  etf_name?: string | null;
  manager?: string | null;
  strategy_type?: StrategyType | null;
  return_since_change?: number | null;
};

/** Server → client 전달용 (Map은 RSC 직렬화 불가) */
export type EtfNameLookup = Record<string, { name: string; manager: string | null }>;

export type EtfMoveTag = {
  etf_ticker: string;
  etf_name: string;
  manager: string | null;
  change_type: HoldingDiff["change_type"];
  weight_delta: number | null;
  est_flow_krw: number | null;
  date: string;
};

export type StockFlowSort = "turnover" | "net_buy" | "net_sell" | "surge" | "drop";

export type ReturnPeriod = "1d" | "1w" | "1m" | "3m" | "1y";

export type StockFlowSummary = {
  stock_code: string;
  stock_name: string | null;
  move_count: number;
  buy_count: number;
  sell_count: number;
  net_flow_krw: number;
  gross_flow_krw: number;
  buy_flow_krw: number;
  sell_flow_krw: number;
  price_return_pct: number | null;
  moves: EtfMoveTag[];
};

export type EtfReturnRankItem = {
  ticker: string;
  name: string;
  manager: string | null;
  strategy_type: StrategyType;
  market: string | null;
  latest_aum: number | null;
  latest_nav: number | null;
  nav_return_pct: number | null;
  change_count?: number;
};

export type OverseasStockRankItem = {
  stock_code: string;
  stock_name: string | null;
  price_return_pct: number | null;
};

export type WeightChartMarker = {
  date: string;
  etfTicker: string;
  changeType: HoldingDiff["change_type"];
};

export type EtfWeightSeries = {
  etfTicker: string;
  etfName: string | null;
  points: { date: string; weight: number }[];
};

/** @deprecated 운용사 합산 — StockDualChart는 EtfWeightSeries 사용 */
export type ManagerWeightSeries = {
  manager: string;
  points: { date: string; weight: number }[];
};

export type StockPricePoint = {
  date: string;
  close: number;
  /** 장중(intraday) 포인트의 epoch(ms). 일별 종가에는 없음 */
  t?: number;
};

export type EtfNavPoint = {
  date: string;
  nav: number;
  aum: number | null;
};

export type PriceRange = "1m" | "3m" | "1y" | "all";

export type DashboardStats = {
  latestDate: string | null;
  earliestDate?: string | null;
  windowDays?: number;
  changeCount: number;
  accumulationFlow: number;
  distributionFlow: number;
  signalCount: number;
  activeEtfCount: number;
};

export type DashboardData = {
  stats: DashboardStats;
  recentChanges: HoldingDiffEnriched[];
  topSignals: SignalDaily[];
};

export type EtfMarketSlice = {
  assetClass: EtfAssetClassId;
  label: string;
  count: number;
  aum: number;
  sharePct: number;
};

export type ActiveMarketOverview = {
  totalAum: number;
  etfCount: number;
  asOfDate: string | null;
  slices: EtfMarketSlice[];
};

export type EtfFlowLeader = {
  ticker: string;
  name: string;
  manager: string | null;
  net_flow_krw: number;
  move_count: number;
  asset_class: EtfAssetClassId;
};

export type ManagerFlowLeader = {
  manager: string;
  net_flow_krw: number;
  etf_count: number;
};

export type EtfFlowSnapshot = {
  windowDays: number;
  totalInflow: number;
  totalOutflow: number;
  topInflow: EtfFlowLeader[];
  topOutflow: EtfFlowLeader[];
  topManagerInflow: ManagerFlowLeader[];
  topManagerOutflow: ManagerFlowLeader[];
};

export type NewListingItem = EtfUniverse & {
  latest_aum: number | null;
  asset_class: EtfAssetClassId;
};

export type EtfShareMetaRow = {
  date: string;
  nav: number | null;
  listed_shares: number | null;
  aum: number | null;
};

export type AssetClassWeeklyFlowRow = {
  weekEnd: string;
  weekLabel: string;
  flows: Record<EtfAssetClassId, number>;
  marketAum: number;
};

export type EtfShareFlowLeader = {
  ticker: string;
  name: string;
  manager: string | null;
  asset_class: EtfAssetClassId;
  net_flow_krw: number;
  week_end: string;
};

export type AssetClassFundFlowReport = {
  weeks: number;
  asOfDate: string | null;
  total12WeekNetFlow: number;
  weekly: AssetClassWeeklyFlowRow[];
  cumulativeByClass: Record<EtfAssetClassId, number>;
  latestWeekByClass: Record<EtfAssetClassId, number>;
  latestWeekEnd: string | null;
  topInflow: EtfShareFlowLeader[];
  topOutflow: EtfShareFlowLeader[];
  hasShareData: boolean;
  assetClassLabels: Record<EtfAssetClassId, string>;
  assetClassOrder: EtfAssetClassId[];
};
