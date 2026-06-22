import type { HoldingDaily } from "@/lib/types";
import { isTrackableStock } from "@/lib/stock-filter";

export function getLatestHoldingsDate(holdings: HoldingDaily[]): string | undefined {
  if (!holdings.length) return undefined;
  return holdings.reduce((latest, row) => (row.date > latest ? row.date : latest), holdings[0].date);
}

export function latestHoldingsSorted(holdings: HoldingDaily[], limit?: number): HoldingDaily[] {
  const latestDate = getLatestHoldingsDate(holdings);
  if (!latestDate) return [];

  const rows = holdings
    .filter((h) => h.date === latestDate && isTrackableStock(h.stock_code, h.stock_name))
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));

  return limit ? rows.slice(0, limit) : rows;
}
