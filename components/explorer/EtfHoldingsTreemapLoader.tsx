import { Suspense } from "react";
import { EtfHoldingsTreemap } from "@/components/explorer/EtfHoldingsTreemap";
import { TopHoldingsCard } from "@/components/explorer/TopHoldingsCard";
import { isListedEquity } from "@/lib/equity-classify";
import { fetchStockPriceSparklinesByRef } from "@/lib/db/queries";
import { latestHoldingsSorted } from "@/lib/holdings";
import { buildTreemapHoldings, latestPriceDate, TREEMAP_RETURN_DAYS } from "@/lib/holdings-treemap";
import type { HoldingDaily } from "@/lib/types";

const TREEMAP_PRICE_LOOKBACK_DAYS = 10;
const TREEMAP_MAX_EQUITY_REFS = 60;
const TREEMAP_MAX_YAHOO_FETCHES = 18;

type Props = {
  holdings: HoldingDaily[];
  etfName: string;
  holdingsDate?: string;
};

async function EtfHoldingsTreemapContent({
  holdings,
  etfName,
  holdingsDate,
}: Props) {
  const equityRefs = latestHoldingsSorted(holdings)
    .filter((row) => isListedEquity(row.stock_name, row.stock_code))
    .slice(0, TREEMAP_MAX_EQUITY_REFS);

  let treemapHoldings = buildTreemapHoldings(holdings, {}, TREEMAP_RETURN_DAYS);
  let priceAsOfDate: string | undefined;

  if (equityRefs.length) {
    try {
      const priceMap = await fetchStockPriceSparklinesByRef(
        equityRefs.map((h) => ({ stock_code: h.stock_code, stock_name: h.stock_name })),
        TREEMAP_PRICE_LOOKBACK_DAYS,
        { maxYahooFetches: TREEMAP_MAX_YAHOO_FETCHES },
      );
      treemapHoldings = buildTreemapHoldings(holdings, priceMap, TREEMAP_RETURN_DAYS);
      priceAsOfDate = latestPriceDate(priceMap);
    } catch (err) {
      console.error("[EtfHoldingsTreemapLoader]", err);
    }
  }

  return (
    <div className="space-y-4">
      <EtfHoldingsTreemap
        holdings={treemapHoldings}
        etfName={etfName}
        holdingsDate={holdingsDate}
        priceAsOfDate={priceAsOfDate}
      />
      <TopHoldingsCard holdings={holdings} etfName={etfName} logoSize={48} />
    </div>
  );
}

export function EtfHoldingsTreemapSkeleton() {
  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-7 w-24 animate-pulse rounded-full bg-[var(--surface-muted)]" />
          ))}
        </div>
        <div className="h-7 w-32 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
        <div className="holdings-treemap-wrap animate-pulse bg-[var(--surface-muted)]" />
      </div>
      <div className="card h-64 animate-pulse bg-[var(--surface-muted)]" />
    </div>
  );
}

export function EtfHoldingsTreemapLoader(props: Props) {
  return (
    <Suspense fallback={<EtfHoldingsTreemapSkeleton />}>
      <EtfHoldingsTreemapContent {...props} />
    </Suspense>
  );
}
