import type { ReturnPeriod, StockFlowSort, StockFlowSummary } from "@/lib/types";

export const STOCK_FLOW_SORTS: { value: StockFlowSort; label: string }[] = [
  { value: "turnover", label: "거래대금" },
  { value: "net_buy", label: "순매수" },
  { value: "net_sell", label: "순매도" },
  { value: "surge", label: "급상승" },
  { value: "drop", label: "급하락" },
];

export const RETURN_PERIODS: { value: ReturnPeriod; label: string }[] = [
  { value: "1d", label: "1일" },
  { value: "1w", label: "1주" },
  { value: "1m", label: "1달" },
  { value: "3m", label: "3달" },
  { value: "1y", label: "1년" },
];

export function periodToDays(period: ReturnPeriod): number {
  switch (period) {
    case "1d":
      return 1;
    case "1w":
      return 7;
    case "1m":
      return 30;
    case "3m":
      return 90;
    case "1y":
      return 365;
    default:
      return 90;
  }
}

export function navSparklineDays(period: ReturnPeriod): number {
  return periodToDays(period) + 14;
}

/** 1일·1주는 장중(5분/30분봉) 시계열로 더 촘촘하게 표시 */
export function isIntradayPeriod(period: ReturnPeriod): period is "1d" | "1w" {
  return period === "1d" || period === "1w";
}

export function computePeriodReturn(
  points: { date: string; value: number }[],
  periodDays: number,
): number | null {
  if (points.length < 2) return null;

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];

  if (periodDays === 1) {
    const prev = sorted[sorted.length - 2];
    if (!prev?.value) return null;
    return ((latest.value - prev.value) / prev.value) * 100;
  }

  const endDate = new Date(latest.date);
  const start = new Date(endDate);
  start.setDate(start.getDate() - periodDays);
  const startStr = start.toISOString().slice(0, 10);

  const baseline = sorted.find((p) => p.date >= startStr) ?? sorted[0];
  if (!baseline.value) return null;

  return ((latest.value - baseline.value) / baseline.value) * 100;
}

export function sortStockFlows(flows: StockFlowSummary[], sort: StockFlowSort): StockFlowSummary[] {
  const copy = [...flows];

  switch (sort) {
    case "turnover":
      return copy.sort((a, b) => b.gross_flow_krw - a.gross_flow_krw || b.move_count - a.move_count);
    case "net_buy":
      return copy
        .filter((f) => f.buy_count > 0 || f.buy_flow_krw > 0)
        .sort((a, b) => b.buy_flow_krw - a.buy_flow_krw || b.buy_count - a.buy_count || b.net_flow_krw - a.net_flow_krw);
    case "net_sell":
      return copy
        .filter((f) => f.sell_count > 0 || f.sell_flow_krw > 0 || f.net_flow_krw < 0)
        .sort((a, b) => b.sell_flow_krw - a.sell_flow_krw || b.sell_count - a.sell_count || a.net_flow_krw - b.net_flow_krw);
    case "surge":
      return copy.sort(
        (a, b) =>
          (b.price_return_pct ?? Number.NEGATIVE_INFINITY) - (a.price_return_pct ?? Number.NEGATIVE_INFINITY),
      );
    case "drop":
      return copy.sort(
        (a, b) => (a.price_return_pct ?? Number.POSITIVE_INFINITY) - (b.price_return_pct ?? Number.POSITIVE_INFINITY),
      );
    default:
      return copy;
  }
}

export function stockFlowSortLabel(sort: StockFlowSort): string {
  return STOCK_FLOW_SORTS.find((s) => s.value === sort)?.label ?? sort;
}

export function returnPeriodLabel(period: ReturnPeriod): string {
  return RETURN_PERIODS.find((p) => p.value === period)?.label ?? period;
}

export function parseStockFlowSort(value?: string | null): StockFlowSort {
  if (value && STOCK_FLOW_SORTS.some((s) => s.value === value)) return value as StockFlowSort;
  return "turnover";
}

export function parseReturnPeriod(value?: string | null): ReturnPeriod {
  if (value && RETURN_PERIODS.some((p) => p.value === value)) return value as ReturnPeriod;
  return "1w";
}
