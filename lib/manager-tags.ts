import type { EtfMoveTag, EtfNameLookup, HoldingDiff } from "@/lib/types";
import { managerKey as canonicalManagerKey } from "@/lib/managers";

export type AggregatedManagerTag = {
  managerKey: string;
  manager: string | null;
  etfTicker: string;
  flowKrw: number;
  changeType: HoldingDiff["change_type"];
};

export type AggregatedEtfTag = {
  etfTicker: string;
  etfName: string;
  manager: string | null;
  flowKrw: number;
  changeType: HoldingDiff["change_type"];
};

export function aggregateMovesByEtf(moves: EtfMoveTag[]): AggregatedEtfTag[] {
  const map = new Map<string, AggregatedEtfTag & { largestMoveAbs: number }>();

  for (const move of moves) {
    const key = move.etf_ticker;
    const flow = move.est_flow_krw ?? 0;
    const prev = map.get(key);

    if (!prev) {
      map.set(key, {
        etfTicker: move.etf_ticker,
        etfName: move.etf_name,
        manager: move.manager,
        flowKrw: flow,
        changeType: move.change_type,
        largestMoveAbs: Math.abs(flow),
      });
      continue;
    }

    prev.flowKrw += flow;
    if (Math.abs(flow) > prev.largestMoveAbs) {
      prev.largestMoveAbs = Math.abs(flow);
      prev.changeType = move.change_type;
    }
    if ((!prev.etfName || prev.etfName === prev.etfTicker) && move.etf_name) {
      prev.etfName = move.etf_name;
    }
    if (!prev.manager && move.manager) prev.manager = move.manager;
  }

  return [...map.values()]
    .sort((a, b) => Math.abs(b.flowKrw) - Math.abs(a.flowKrw))
    .map(({ largestMoveAbs: _, ...item }) => item);
}

export function aggregateMovesByManager(moves: EtfMoveTag[]): AggregatedManagerTag[] {
  const map = new Map<
    string,
    AggregatedManagerTag & { largestMoveAbs: number }
  >();

  for (const move of moves) {
    const managerKey = canonicalManagerKey(move.manager) || move.etf_ticker;
    const flow = move.est_flow_krw ?? 0;
    const prev = map.get(managerKey);

    if (!prev) {
      map.set(managerKey, {
        managerKey,
        manager: move.manager,
        etfTicker: move.etf_ticker,
        flowKrw: flow,
        changeType: move.change_type,
        largestMoveAbs: Math.abs(flow),
      });
      continue;
    }

    prev.flowKrw += flow;
    if (Math.abs(flow) > prev.largestMoveAbs) {
      prev.largestMoveAbs = Math.abs(flow);
      prev.etfTicker = move.etf_ticker;
      prev.changeType = move.change_type;
    }
    if (!prev.manager && move.manager) prev.manager = move.manager;
  }

  return [...map.values()]
    .sort((a, b) => Math.abs(b.flowKrw) - Math.abs(a.flowKrw))
    .map(({ largestMoveAbs: _, ...item }) => item);
}

export function aggregateManagersFromTickers(
  tickers: string[],
  etfMap?: EtfNameLookup,
): { managerKey: string; manager: string | null; etfTicker: string }[] {
  const map = new Map<string, { manager: string | null; etfTicker: string }>();

  for (const ticker of tickers) {
    const manager = etfMap?.[ticker]?.manager ?? null;
    const managerKey = canonicalManagerKey(manager) || ticker;
    if (!map.has(managerKey)) {
      map.set(managerKey, { manager, etfTicker: ticker });
    }
  }

  return [...map.entries()].map(([managerKey, value]) => ({
    managerKey,
    ...value,
  }));
}
