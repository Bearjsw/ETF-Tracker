"use client";

import { useState } from "react";
import { StockFlowLayoutToggle } from "@/components/explorer/StockFlowLayoutToggle";
import { StockFlowList } from "@/components/explorer/StockFlowList";
import type { StockFlowSort, StockFlowSummary, StockPricePoint } from "@/lib/types";
import type { ReturnPeriod } from "@/lib/types";

type Props = {
  flows: StockFlowSummary[];
  priceByStock: Record<string, StockPricePoint[]>;
  sort: StockFlowSort;
  period: ReturnPeriod;
};

export function HomeStockFlowSection({ flows, priceByStock, sort, period }: Props) {
  const [layout, setLayout] = useState<"list" | "grid">("list");

  return (
    <StockFlowList
      flows={flows}
      priceByStock={priceByStock}
      sort={sort}
      period={period}
      layout={layout}
      headerAction={
        flows.length > 0 ? <StockFlowLayoutToggle value={layout} onChange={setLayout} /> : null
      }
    />
  );
}
