-- ETF-Tracker initial schema

create table if not exists etf_universe (
  ticker text primary key,
  name text not null,
  manager text,
  market text,
  strategy_type text not null check (strategy_type in ('active', 'passive', 'theme')),
  theme_tags text[] default '{}',
  listing_date date,
  delist_date date,
  is_listed boolean not null default true,
  crawl_enabled boolean not null default false,
  source text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_etf_universe_manager on etf_universe (manager);
create index if not exists idx_etf_universe_strategy on etf_universe (strategy_type, crawl_enabled);
create index if not exists idx_etf_universe_listed on etf_universe (is_listed);

create table if not exists holdings_daily (
  date date not null,
  etf_ticker text not null references etf_universe (ticker) on delete cascade,
  stock_code text not null,
  stock_name text,
  weight numeric,
  quantity bigint,
  primary key (date, etf_ticker, stock_code)
);

create index if not exists idx_holdings_daily_etf_date on holdings_daily (etf_ticker, date desc);
create index if not exists idx_holdings_daily_stock on holdings_daily (stock_code, date desc);

create table if not exists etf_meta_daily (
  date date not null,
  etf_ticker text not null references etf_universe (ticker) on delete cascade,
  aum numeric,
  nav numeric,
  listed_shares bigint,
  primary key (date, etf_ticker)
);

create index if not exists idx_etf_meta_daily_ticker on etf_meta_daily (etf_ticker, date desc);

create table if not exists holdings_diff (
  date date not null,
  etf_ticker text not null references etf_universe (ticker) on delete cascade,
  stock_code text not null,
  stock_name text,
  change_type text not null check (change_type in ('new', 'removed', 'weight_up', 'weight_down')),
  weight_prev numeric,
  weight_curr numeric,
  weight_delta numeric,
  est_flow_krw numeric,
  primary key (date, etf_ticker, stock_code, change_type)
);

create index if not exists idx_holdings_diff_date on holdings_diff (date desc, change_type);
create index if not exists idx_holdings_diff_stock on holdings_diff (stock_code, date desc);

create table if not exists signals_daily (
  date date not null,
  stock_code text not null,
  stock_name text,
  signal_type text not null check (signal_type in ('new_entry', 'consensus', 'weight_surge', 'convergence')),
  direction text not null check (direction in ('accumulation', 'distribution')),
  window_days int,
  etf_count int default 0,
  etf_tickers text[] default '{}',
  score numeric,
  strength text,
  metadata jsonb default '{}',
  primary key (date, stock_code, signal_type, window_days)
);

create index if not exists idx_signals_daily_date on signals_daily (date desc, signal_type);

create table if not exists signal_clusters (
  id bigserial primary key,
  stock_code text not null,
  stock_name text,
  signal_type text not null,
  direction text not null,
  window_days int,
  cluster_start date not null,
  cluster_end date not null,
  etf_count int default 0,
  etf_tickers text[] default '{}',
  score numeric,
  strength text,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_signal_clusters_stock on signal_clusters (stock_code, cluster_end desc);

create table if not exists prices_daily (
  date date not null,
  stock_code text not null,
  close numeric,
  primary key (date, stock_code)
);
