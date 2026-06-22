import { HomeStockFlowSection } from "@/components/explorer/HomeStockFlowSection";
import { fetchStockFlows, fetchStockPriceSparklinesByRef } from "@/lib/db/queries";
import type { ReturnPeriod, StockFlowSort } from "@/lib/types";
import { periodToDays } from "@/lib/rankings";

type Props = {
  manager?: string;
  sort: StockFlowSort;
  period: ReturnPeriod;
  limit?: number;
};

export async function HomeStockFlowLoader({ manager, sort, period, limit = 30 }: Props) {
  const stockFlows = (await fetchStockFlows(manager, 30, sort, period)).slice(0, limit);
  const priceByStock = await fetchStockPriceSparklinesByRef(
    stockFlows.map((f) => ({ stock_code: f.stock_code, stock_name: f.stock_name ?? null })),
    periodToDays(period) + 14,
    { maxYahooFetches: 12 },
  );

  return (
    <HomeStockFlowSection flows={stockFlows} priceByStock={priceByStock} sort={sort} period={period} />
  );
}

export function HomeStockFlowSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-28 animate-pulse bg-[var(--surface-muted)]" />
        ))}
      </div>
    </div>
  );
}
