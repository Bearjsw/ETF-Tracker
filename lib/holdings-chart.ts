import type { HoldingDaily } from "@/lib/types";
import { getLatestHoldingsDate } from "@/lib/holdings";
import { getStockChartColor } from "@/lib/stock-colors";
import { isTrackableStock } from "@/lib/stock-filter";

export type HoldingPieSlice = {
  stock_code: string;
  name: string;
  weight: number;
  color: string;
  isOther?: boolean;
  otherCount?: number;
};

export function buildHoldingsPieSlices(holdings: HoldingDaily[], topN = 10): HoldingPieSlice[] {
  const latestDate = getLatestHoldingsDate(holdings);
  if (!latestDate) return [];

  const rows = holdings
    .filter(
      (h) =>
        h.date === latestDate &&
        h.weight != null &&
        h.weight > 0 &&
        isTrackableStock(h.stock_code, h.stock_name),
    )
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));

  if (!rows.length) return [];

  const top = rows.slice(0, topN);
  const rest = rows.slice(topN);
  const slices: HoldingPieSlice[] = top.map((row, index) => ({
    stock_code: row.stock_code,
    name: row.stock_name ?? row.stock_code,
    weight: Number(row.weight),
    color: getStockChartColor(row.stock_code, row.stock_name, index),
  }));

  if (rest.length) {
    const otherWeight = rest.reduce((sum, row) => sum + Number(row.weight ?? 0), 0);
    if (otherWeight > 0) {
      slices.push({
        stock_code: "__other__",
        name: `기타 ${rest.length}종목`,
        weight: otherWeight,
        color: "#cbd5c9",
        isOther: true,
        otherCount: rest.length,
      });
    }
  }

  return slices;
}
