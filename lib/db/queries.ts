import type {
  EtfListItem,
  EtfMetaDaily,
  EtfUniverse,
  HoldingDaily,
  HoldingDiff,
  SignalDaily,
} from "@/lib/types";
import { getSql } from "@/lib/db/client";
import {
  demoFetchEtfDetail,
  demoFetchEtfList,
  demoFetchManagers,
  demoFetchManagerSummary,
  demoFetchSignals,
  demoFetchStockHoldings,
} from "@/lib/db/demo-data";
import { isDatabaseConfigured } from "@/lib/db/env";

function asEtfUniverse(row: Record<string, unknown>): EtfUniverse {
  return {
    ticker: String(row.ticker),
    name: String(row.name),
    manager: row.manager != null ? String(row.manager) : null,
    market: row.market != null ? String(row.market) : null,
    strategy_type: row.strategy_type as EtfUniverse["strategy_type"],
    theme_tags: (row.theme_tags as string[] | null) ?? [],
    listing_date: row.listing_date != null ? String(row.listing_date).slice(0, 10) : null,
    delist_date: row.delist_date != null ? String(row.delist_date).slice(0, 10) : null,
    is_listed: Boolean(row.is_listed),
    crawl_enabled: Boolean(row.crawl_enabled),
  };
}

export async function fetchEtfList(filters?: {
  manager?: string;
  strategy?: string;
  market?: string;
  listedOnly?: boolean;
}): Promise<EtfListItem[]> {
  if (!isDatabaseConfigured()) return demoFetchEtfList(filters);

  const sql = getSql();
  const manager = filters?.manager ?? null;
  const strategy = filters?.strategy ?? null;
  const market = filters?.market ?? null;
  const listedOnly = filters?.listedOnly ?? null;

  const rows = (await sql`
    SELECT * FROM etf_universe
    WHERE (${manager}::text IS NULL OR manager = ${manager})
      AND (${strategy}::text IS NULL OR strategy_type = ${strategy})
      AND (${market}::text IS NULL OR market = ${market})
      AND (${listedOnly}::bool IS NULL OR is_listed = ${listedOnly})
    ORDER BY name
  `) as Record<string, unknown>[];

  const etfs = rows.map(asEtfUniverse);
  if (!etfs.length) return [];

  const tickers = etfs.map((e) => e.ticker);
  const metaRows = (await sql`
    SELECT etf_ticker, aum, date
    FROM etf_meta_daily
    WHERE etf_ticker = ANY(${tickers}::text[])
    ORDER BY date DESC
  `) as { etf_ticker: string; aum: number | null; date: string }[];
  const diffRows = (await sql`
    SELECT etf_ticker FROM holdings_diff WHERE etf_ticker = ANY(${tickers}::text[])
  `) as { etf_ticker: string }[];

  const latestAum = new Map<string, number | null>();
  for (const row of metaRows) {
    if (!latestAum.has(row.etf_ticker)) {
      latestAum.set(row.etf_ticker, row.aum);
    }
  }

  const changeCount = new Map<string, number>();
  for (const row of diffRows) {
    changeCount.set(row.etf_ticker, (changeCount.get(row.etf_ticker) ?? 0) + 1);
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
  const holdings = (await sql`
    SELECT * FROM holdings_daily WHERE etf_ticker = ${ticker} ORDER BY date DESC LIMIT 200
  `) as HoldingDaily[];
  const diffs = (await sql`
    SELECT * FROM holdings_diff WHERE etf_ticker = ${ticker} ORDER BY date DESC LIMIT 100
  `) as HoldingDiff[];
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
  const etfRows = (await sql`
    SELECT * FROM etf_universe WHERE manager = ${manager} ORDER BY name
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
  const holdings = (await sql`
    SELECT * FROM holdings_daily WHERE stock_code = ${stockCode} ORDER BY date DESC LIMIT 300
  `) as HoldingDaily[];
  const tickers = [...new Set(holdings.map((h) => h.etf_ticker))];

  const etfRows = tickers.length
    ? ((await sql`
        SELECT * FROM etf_universe WHERE ticker = ANY(${tickers}::text[])
      `) as Record<string, unknown>[])
    : [];

  const diffs = (await sql`
    SELECT * FROM holdings_diff WHERE stock_code = ${stockCode} ORDER BY date DESC LIMIT 100
  `) as HoldingDiff[];

  return {
    holdings,
    etfs: etfRows.map(asEtfUniverse),
    diffs,
  };
}

export async function fetchSignals(limit = 100): Promise<SignalDaily[]> {
  if (!isDatabaseConfigured()) return demoFetchSignals(limit);

  const sql = getSql();
  return (await sql`
    SELECT * FROM signals_daily ORDER BY date DESC LIMIT ${limit}
  `) as SignalDaily[];
}

export async function fetchManagers(): Promise<string[]> {
  if (!isDatabaseConfigured()) return demoFetchManagers();

  const sql = getSql();
  const rows = (await sql`
    SELECT DISTINCT manager FROM etf_universe WHERE manager IS NOT NULL ORDER BY manager
  `) as { manager: string }[];
  return rows.map((r) => r.manager);
}
