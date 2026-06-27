import { FlowsChangeFeedSection } from "@/components/explorer/FlowsChangeFeedSection";
import { fetchFlowsPageChangesEnriched, fetchStockPriceSparklinesByRef } from "@/lib/db/queries";
import { dedupeStockRefs } from "@/lib/stock-ref";

type Props = {
  manager?: string;
};

export async function FlowsChangesLoader({ manager }: Props) {
  const changes = await fetchFlowsPageChangesEnriched(manager, true);
  const priceRefs = dedupeStockRefs(
    changes.map((c) => ({ stock_code: c.stock_code, stock_name: c.stock_name })),
  );
  const priceByStock = await fetchStockPriceSparklinesByRef(priceRefs, 90, { maxYahooFetches: 24 });

  return <FlowsChangeFeedSection changes={changes} priceByStock={priceByStock} />;
}

export function FlowsChangesSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card h-36 animate-pulse bg-[var(--surface-muted)]" />
      ))}
    </div>
  );
}
