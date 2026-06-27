"use client";

import { useMemo } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  visibleEquityBoardOptions,
  type StockBoardFilter,
  type StockCategoryFilter,
  type StockMarket,
} from "@/lib/stock-filters";

type Props = {
  market: StockMarket | "all";
  category: StockCategoryFilter;
  board: StockBoardFilter;
  stocks: { stock_name?: string | null; stock_code: string }[];
  onChange: (board: StockBoardFilter) => void;
  className?: string;
};

export function EquityBoardFilter({ market, category, board, stocks, onChange, className }: Props) {
  const options = useMemo(
    () => visibleEquityBoardOptions(market, category, stocks, { includeCount: true }),
    [market, category, stocks],
  );

  if (options.length <= 1) return null;

  const active = options.some((o) => o.value === board) ? board : "all";

  return (
    <SegmentedControl
      items={options}
      value={active}
      onChange={onChange}
      className={className}
      ariaLabel={market === "domestic" ? "국내 주식 시장" : "미국 거래소"}
    />
  );
}
