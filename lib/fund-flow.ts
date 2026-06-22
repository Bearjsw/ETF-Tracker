import {
  ETF_ASSET_CLASS_LABELS,
  ETF_ASSET_CLASS_ORDER,
  inferEtfAssetClass,
  type EtfAssetClassId,
} from "@/lib/etf-asset-class";
import type {
  AssetClassFundFlowReport,
  AssetClassWeeklyFlowRow,
  EtfShareFlowLeader,
  EtfShareMetaRow,
} from "@/lib/types";

export function resolveListedShares(row: Pick<EtfShareMetaRow, "listed_shares" | "aum" | "nav">): number | null {
  if (row.listed_shares != null && row.listed_shares > 0) return row.listed_shares;
  if (row.aum != null && row.nav != null && row.aum > 0 && row.nav > 0) {
    return Math.round(row.aum / row.nav);
  }
  return null;
}

function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekEndLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

type WeeklySnapshot = {
  weekEnd: string;
  nav: number;
  shares: number;
  aum: number;
};

/** 앵커일 이하 최신 스냅샷 (누락 구간은 직전 값으로 채움) */
function resolveSnapshotAtOrBefore(rows: EtfShareMetaRow[], asOf: string): WeeklySnapshot | null {
  let best: WeeklySnapshot | null = null;

  for (const row of rows) {
    if (row.date > asOf) continue;
    const shares = resolveListedShares(row);
    if (shares == null || row.nav == null || row.nav <= 0) continue;

    if (!best || row.date >= best.weekEnd) {
      best = {
        weekEnd: row.date,
        nav: row.nav,
        shares,
        aum: row.aum ?? shares * row.nav,
      };
    }
  }

  return best;
}

export type EtfWeeklyFlow = {
  ticker: string;
  name: string;
  manager: string | null;
  assetClass: EtfAssetClassId;
  weekEnd: string;
  netFlowKrw: number;
};

/** 차트 타임라인 앵커 기준 ETF별 Δ좌수×NAV */
export function computeEtfWeeklyFlows(
  etfs: { ticker: string; name: string; manager: string | null; rows: EtfShareMetaRow[] }[],
  timeline: string[],
): EtfWeeklyFlow[] {
  const flows: EtfWeeklyFlow[] = [];

  for (const etf of etfs) {
    let prev: WeeklySnapshot | null = null;

    for (const anchor of timeline) {
      const curr = resolveSnapshotAtOrBefore(etf.rows, anchor);
      if (!curr) continue;

      if (prev) {
        const deltaShares = curr.shares - prev.shares;
        if (deltaShares !== 0) {
          flows.push({
            ticker: etf.ticker,
            name: etf.name,
            manager: etf.manager,
            assetClass: inferEtfAssetClass(etf.name),
            weekEnd: anchor,
            netFlowKrw: deltaShares * curr.nav,
          });
        }
      }

      prev = curr;
    }
  }

  return flows;
}

function emptyFlowsRecord(): Record<EtfAssetClassId, number> {
  return Object.fromEntries(ETF_ASSET_CLASS_ORDER.map((c) => [c, 0])) as Record<EtfAssetClassId, number>;
}

export const DEFAULT_FUND_FLOW_WEEKS = 8;

/** 최신일 기준 7일 간격 주차 앵커 (차트 N주 고정) */
export function buildWeekTimeline(latestDate: string, weekCount: number): string[] {
  const timeline: string[] = [];
  const end = new Date(`${latestDate}T12:00:00`);
  for (let i = weekCount - 1; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setDate(d.getDate() - i * 7);
    timeline.push(toLocalIsoDate(d));
  }
  return timeline;
}

function marketAumAtAnchor(
  etfs: { rows: EtfShareMetaRow[] }[],
  anchor: string,
): number {
  let marketAum = 0;
  for (const etf of etfs) {
    const snap = resolveSnapshotAtOrBefore(etf.rows, anchor);
    if (snap) marketAum += snap.aum;
  }
  return marketAum;
}

export function buildAssetClassFundFlowReport(
  etfs: { ticker: string; name: string; manager: string | null; rows: EtfShareMetaRow[] }[],
  weeks = DEFAULT_FUND_FLOW_WEEKS,
): AssetClassFundFlowReport {
  const latestMetaDate =
    etfs.flatMap((e) => e.rows).sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? null;
  const anchorDate = latestMetaDate;
  const hasShareData =
    anchorDate != null &&
    etfs.some((etf) => etf.rows.some((row) => resolveListedShares(row) != null));

  if (!anchorDate || !hasShareData) {
    return {
      weeks,
      asOfDate: anchorDate,
      total12WeekNetFlow: 0,
      weekly: [],
      cumulativeByClass: emptyFlowsRecord(),
      latestWeekByClass: emptyFlowsRecord(),
      latestWeekEnd: null,
      topInflow: [],
      topOutflow: [],
      hasShareData: false,
      assetClassLabels: ETF_ASSET_CLASS_LABELS,
      assetClassOrder: ETF_ASSET_CLASS_ORDER,
    };
  }

  const selectedWeeks = buildWeekTimeline(anchorDate, weeks);
  const etfWeeklyFlows = computeEtfWeeklyFlows(etfs, selectedWeeks);

  const weekly: AssetClassWeeklyFlowRow[] = [];
  const cumulativeByClass = emptyFlowsRecord();

  for (const weekAnchor of selectedWeeks) {
    const flows = emptyFlowsRecord();
    const marketAum = marketAumAtAnchor(etfs, weekAnchor);

    for (const flow of etfWeeklyFlows.filter((f) => f.weekEnd === weekAnchor)) {
      flows[flow.assetClass] += flow.netFlowKrw;
      cumulativeByClass[flow.assetClass] += flow.netFlowKrw;
    }

    weekly.push({
      weekEnd: weekAnchor,
      weekLabel: weekEndLabel(weekAnchor),
      flows,
      marketAum,
    });
  }

  const latestWeek = selectedWeeks[selectedWeeks.length - 1] ?? null;
  const latestWeekByClass = emptyFlowsRecord();
  if (latestWeek) {
    for (const flow of etfWeeklyFlows.filter((f) => f.weekEnd === latestWeek)) {
      latestWeekByClass[flow.assetClass] += flow.netFlowKrw;
    }
  }

  const total12WeekNetFlow = weekly.reduce(
    (sum, w) => sum + ETF_ASSET_CLASS_ORDER.reduce((s, c) => s + w.flows[c], 0),
    0,
  );

  const latestWeekFlows = latestWeek
    ? etfWeeklyFlows.filter((f) => f.weekEnd === latestWeek)
    : [];

  const topInflow: EtfShareFlowLeader[] = [...latestWeekFlows]
    .filter((f) => f.netFlowKrw > 0)
    .sort((a, b) => b.netFlowKrw - a.netFlowKrw)
    .slice(0, 5)
    .map((f) => ({
      ticker: f.ticker,
      name: f.name,
      manager: f.manager,
      asset_class: f.assetClass,
      net_flow_krw: f.netFlowKrw,
      week_end: f.weekEnd,
    }));

  const topOutflow: EtfShareFlowLeader[] = [...latestWeekFlows]
    .filter((f) => f.netFlowKrw < 0)
    .sort((a, b) => a.netFlowKrw - b.netFlowKrw)
    .slice(0, 5)
    .map((f) => ({
      ticker: f.ticker,
      name: f.name,
      manager: f.manager,
      asset_class: f.assetClass,
      net_flow_krw: f.netFlowKrw,
      week_end: f.weekEnd,
    }));

  return {
    weeks,
    asOfDate: anchorDate,
    total12WeekNetFlow,
    weekly,
    cumulativeByClass,
    latestWeekByClass,
    latestWeekEnd: latestWeek,
    topInflow,
    topOutflow,
    hasShareData,
    assetClassLabels: ETF_ASSET_CLASS_LABELS,
    assetClassOrder: ETF_ASSET_CLASS_ORDER,
  };
}
