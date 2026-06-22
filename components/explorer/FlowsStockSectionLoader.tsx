import { Suspense } from "react";
import { FlowDataNotice } from "@/components/explorer/FlowDataNotice";
import { StockFlowFilters } from "@/components/explorer/StockFlowFilters";
import { StockFlowList } from "@/components/explorer/StockFlowList";
import { StockFlowSortBar } from "@/components/explorer/StockFlowSortBar";
import { parseReturnPeriod, parseStockFlowSort, stockFlowSortLabel } from "@/lib/rankings";
import {
  fetchManagers,
  fetchStockFlowDataScope,
  fetchStockFlows,
  fetchStockPriceSparklinesByRef,
} from "@/lib/db/queries";
import {
  matchesStockFilters,
  matchesStockQuery,
  normalizeCategoryForMarket,
  parseStockCategory,
  parseStockMarket,
} from "@/lib/stock-filters";

type Props = {
  manager?: string;
  sort: ReturnType<typeof parseStockFlowSort>;
  period: ReturnType<typeof parseReturnPeriod>;
  market: ReturnType<typeof parseStockMarket>;
  category: ReturnType<typeof parseStockCategory>;
  params: {
    manager?: string;
    sort?: string;
    period?: string;
    market?: string;
    category?: string;
    q?: string;
  };
};

export async function FlowsStockSectionLoader({ manager, sort, period, market, category, params }: Props) {
  const [allStockFlows, managers, dataScope] = await Promise.all([
    fetchStockFlows(manager, 60, sort, period),
    fetchManagers(),
    fetchStockFlowDataScope(),
  ]);

  const filterStock = (stockName?: string | null, stockCode?: string) =>
    matchesStockFilters(stockName, stockCode, market, category);

  const stockFlows = allStockFlows
    .filter((f) => filterStock(f.stock_name, f.stock_code))
    .filter((f) => matchesStockQuery(f.stock_name, f.stock_code, params.q))
    .slice(0, 50);
  const filterUniverse = allStockFlows.map((f) => ({
    stock_name: f.stock_name,
    stock_code: f.stock_code,
  }));

  const priceByStock = await fetchStockPriceSparklinesByRef(
    stockFlows.map((f) => ({ stock_code: f.stock_code, stock_name: f.stock_name ?? null })),
    90,
    { maxYahooFetches: 12 },
  );

  const title = manager
    ? `${manager} · ${stockFlowSortLabel(sort)} TOP ${stockFlows.length}`
    : `${stockFlowSortLabel(sort)} TOP ${stockFlows.length}`;

  return (
    <>
      <Suspense fallback={<div className="signal-filter-bar h-12 animate-pulse bg-white/60" />}>
        <StockFlowFilters
          managers={managers}
          stocks={filterUniverse}
          current={{
            manager: params.manager,
            sort: params.sort,
            period: params.period,
            market: params.market,
            category: params.category,
            q: params.q,
          }}
        />
      </Suspense>

      <Suspense fallback={null}>
        <StockFlowSortBar current={{ sort, period, manager }} />
      </Suspense>

      <FlowDataNotice
        trackedStocks={dataScope.trackedStocks}
        hasSellEvents={dataScope.hasSellEvents}
        krxConfigured={dataScope.krxConfigured}
      />

      <StockFlowList
        flows={stockFlows}
        priceByStock={priceByStock}
        title={title}
        sort={sort}
        period={period}
      />
    </>
  );
}

export function FlowsStockSectionSkeleton() {
  return (
    <>
      <div className="signal-filter-bar h-12 animate-pulse bg-white/60" />
      <div className="card h-64 animate-pulse bg-[var(--surface-muted)]" />
    </>
  );
}
