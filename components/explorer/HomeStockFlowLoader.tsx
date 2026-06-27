import { StockFlowList } from "@/components/explorer/StockFlowList";
import { fetchStockFlows, fetchStockIntradayByRef, fetchStockPriceSparklinesByRef } from "@/lib/db/queries";
import type { ReturnPeriod, StockFlowSort } from "@/lib/types";
import { isIntradayPeriod, periodToDays } from "@/lib/rankings";

type Props = {
  manager?: string;
  sort: StockFlowSort;
  period: ReturnPeriod;
  limit?: number;
};

export async function HomeStockFlowLoader({ manager, sort, period, limit = 30 }: Props) {
  const stockFlows = (await fetchStockFlows(manager, 30, sort, period)).slice(0, limit);
  const priceRefs = stockFlows.map((f) => ({ stock_code: f.stock_code, stock_name: f.stock_name ?? null }));
  const priceByStock = isIntradayPeriod(period)
    ? await fetchStockIntradayByRef(priceRefs, period, { maxYahooFetches: 16 })
    : await fetchStockPriceSparklinesByRef(priceRefs, periodToDays(period) + 14, { maxYahooFetches: 12 });

  return (
    <StockFlowList
      flows={stockFlows}
      priceByStock={priceByStock}
      sort={sort}
      period={period}
    />
  );
}

export function HomeStockFlowSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-24 animate-pulse bg-[var(--surface-muted)]" />
        ))}
      </div>
    </div>
  );
}
