import type { HoldingDiffEnriched } from "@/lib/types";

/** Look-through rebalance estimate window (matches /flows ETF snapshot). */
export const REBALANCE_FLOW_WINDOW_DAYS = 7;

export const FLOW_AUM_CAP_MULTIPLIER = 1.25;

export const DEFAULT_MEDIAN_AUM_KRW = 50_000_000_000;

export function flowCapKrw(aum: number | null | undefined, weightDelta: number | null | undefined): number | null {
  if (aum == null || aum <= 0 || weightDelta == null || weightDelta === 0) return null;
  return Math.abs(aum) * (Math.min(Math.abs(weightDelta), 100) / 100) * FLOW_AUM_CAP_MULTIPLIER;
}

export function expectedFlowKrw(aum: number, weightDelta: number): number {
  return aum * (weightDelta / 100);
}

export type FlowEstimateInput = Pick<HoldingDiffEnriched, "est_flow_krw" | "weight_delta" | "etf_ticker">;

export function resolveEstFlowKrw(
  change: FlowEstimateInput,
  aumByTicker: Map<string, number> | Record<string, number>,
  medianAum = DEFAULT_MEDIAN_AUM_KRW,
): number {
  const delta = change.weight_delta;
  if (delta == null || delta === 0) return change.est_flow_krw ?? 0;

  const map = aumByTicker instanceof Map ? aumByTicker : new Map(Object.entries(aumByTicker));
  const aum = map.get(change.etf_ticker) ?? 0;
  const baseAum = aum > 0 ? aum : medianAum;
  const expected = expectedFlowKrw(baseAum, delta);
  const stored = change.est_flow_krw ?? 0;

  if (!stored) return expected;

  const cap = flowCapKrw(baseAum, delta);
  if (cap != null && Math.abs(stored) <= cap) return stored;
  return expected;
}

export function enrichChangesWithFlowEstimates(
  changes: HoldingDiffEnriched[],
  aumByTicker: Map<string, number> | Record<string, number>,
  medianAum = DEFAULT_MEDIAN_AUM_KRW,
): HoldingDiffEnriched[] {
  return changes.map((change) => {
    const resolved = resolveEstFlowKrw(change, aumByTicker, medianAum);
    if (resolved === (change.est_flow_krw ?? 0)) return change;
    return { ...change, est_flow_krw: resolved };
  });
}

export function filterDiffsByWindow<T extends { date: string }>(diffs: T[], windowDays: number): T[] {
  if (!diffs.length) return [];
  const latest = diffs.reduce((max, d) => (d.date > max ? d.date : max), diffs[0].date);
  const cutoff = new Date(`${latest}T12:00:00`);
  cutoff.setDate(cutoff.getDate() - (windowDays - 1));
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return diffs.filter((d) => d.date >= cutoffIso);
}

export function summarizeFlowTotals(
  diffs: { est_flow_krw?: number | null }[],
  aum?: number | null,
): { inflow: number; outflow: number } {
  let inflow = 0;
  let outflow = 0;
  for (const d of diffs) {
    const flow = d.est_flow_krw ?? 0;
    if (flow > 0) inflow += flow;
    else if (flow < 0) outflow += Math.abs(flow);
  }
  const cap = aum && aum > 0 ? aum * FLOW_AUM_CAP_MULTIPLIER : null;
  if (cap != null) {
    inflow = Math.min(inflow, cap);
    outflow = Math.min(outflow, cap);
  }
  return { inflow, outflow };
}

export const REBALANCE_FLOW_FOOTNOTE = "look-through 보유 비중 변화 추정";
export const SUBSCRIPTION_FLOW_FOOTNOTE = "Δ상장좌수 × NAV (설정·환매)";
