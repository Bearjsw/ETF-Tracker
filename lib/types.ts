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

export type EtfListItem = EtfUniverse & {
  latest_aum?: number | null;
  change_count?: number;
};
