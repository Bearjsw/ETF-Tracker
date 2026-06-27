import type { HoldingDaily } from "@/lib/types";
import { isListedEquity } from "@/lib/equity-classify";
import { latestHoldingsSorted } from "@/lib/holdings";
import { computePeriodReturn } from "@/lib/rankings";
import { stockRefKey } from "@/lib/stock-ref";
import type { StockPricePoint } from "@/lib/types";

export type TreemapHolding = {
  stock_code: string;
  stock_name: string | null;
  weight: number;
  returnPct: number | null;
  fill: string;
};

export type TreemapStats = {
  count: number;
  up: number;
  down: number;
  flat: number;
  totalWeight: number;
};

const RETURN_CLAMP = 5;
const FLAT_THRESHOLD = 0.15;

/** 트리맵 색상에 쓰는 수익률 기간 (전일 대비 1일) */
export const TREEMAP_RETURN_DAYS = 1;

/** 배경색 상대 휘도 (0~1) */
function fillLuminance(hex: string): number {
  const norm = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(norm.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** ETF Tracker 로고 원형 배경 (--accent-bright) */
export const TREEMAP_LOGO_GREEN = "#9fe870";
/** 로고 연두를 accent-muted 쪽으로 톤다운 (트리맵용) */
export const TREEMAP_LOGO_GREEN_SOFT = "#c8e2b0";

/** -5 ~ +5 구간별 단계 색 (그라데이션 아님) */
export const TREEMAP_BUCKET_COLORS: Record<number, string> = {
  [-5]: "#5da880",
  [-4]: TREEMAP_LOGO_GREEN_SOFT,
  [-3]: "#e6f2d4",
  [-2]: "#f0f7ea",
  [-1]: "#f6f9f4",
  [-0.75]: "#f4f7f3",
  [-0.5]: "#f2f5f1",
  [-0.25]: "#eeefec",
  [0]: "#ecefeb",
  [1]: "#fdeaea",
  [2]: "#fad4d4",
  [3]: "#f6b4b4",
  [4]: "#f29393",
  [5]: "#ef7070",
};

export const TREEMAP_LEGEND_ORDER = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5] as const;

export function returnBucket(pct: number): number {
  if (Math.abs(pct) < FLAT_THRESHOLD) return 0;
  const clamped = Math.max(-RETURN_CLAMP, Math.min(RETURN_CLAMP, pct));
  if (clamped > 0) return Math.min(RETURN_CLAMP, Math.max(1, Math.ceil(clamped)));
  if (clamped > -0.35) return -0.25;
  if (clamped > -0.55) return -0.5;
  if (clamped > -0.8) return -0.75;
  if (clamped > -1) return -1;
  return Math.max(-RETURN_CLAMP, Math.min(-2, Math.floor(clamped)));
}

/** 상승 연한 빨강 · 하락 연두·초록 · 보합 밝은 회색 (한국 주식 관행, 단계색) */
export function treemapReturnColor(pct: number | null, clamp = RETURN_CLAMP): string {
  if (pct == null) return "#e8ebe6";
  if (Math.abs(pct) < FLAT_THRESHOLD) return TREEMAP_BUCKET_COLORS[0];

  const bucket = returnBucket(Math.max(-clamp, Math.min(clamp, pct)));
  return TREEMAP_BUCKET_COLORS[bucket] ?? TREEMAP_BUCKET_COLORS[0];
}

/** 밝은 칸은 진한 회색, 어두운 칸은 흰색 (배경 휘도 기준) */
export function treemapLabelColor(fill: string): string {
  return fillLuminance(fill) > 0.42 ? "#3a4238" : "#ffffff";
}

export const TREEMAP_CELL_GAP = 2;
export const TREEMAP_CELL_RADIUS = 4;

/** 작은·가장자리 셀은 gap을 줄여 hover 시 가로 폭이 과도하게 좁아지지 않게 합니다. */
export function treemapCellLayout(
  x: number,
  y: number,
  width: number,
  height: number,
  gap = TREEMAP_CELL_GAP,
  maxRadius = TREEMAP_CELL_RADIUS,
) {
  const minDim = Math.min(width, height);
  const inset = minDim < 8 ? 0 : minDim < 18 ? 1 : gap;
  const innerX = x + inset;
  const innerY = y + inset;
  const innerW = Math.max(0, width - inset * 2);
  const innerH = Math.max(0, height - inset * 2);
  const radius = inset === 0 ? 0 : Math.min(maxRadius, innerW / 2, innerH / 2);

  return { inset, innerX, innerY, innerW, innerH, radius };
}

export function buildTreemapHoldings(
  holdings: HoldingDaily[],
  priceMap: Record<string, StockPricePoint[]>,
  periodDays = TREEMAP_RETURN_DAYS,
): TreemapHolding[] {
  const rows = latestHoldingsSorted(holdings);

  return rows
    .filter((row) => (row.weight ?? 0) > 0)
    .map((row) => {
      let returnPct: number | null = null;
      if (isListedEquity(row.stock_name, row.stock_code)) {
        const key = stockRefKey({ stock_code: row.stock_code, stock_name: row.stock_name });
        const points = priceMap[key] ?? priceMap[row.stock_code] ?? [];
        returnPct = computePeriodReturn(
          points.map((p) => ({ date: p.date, value: p.close })),
          periodDays,
        );
      }

      return {
        stock_code: row.stock_code,
        stock_name: row.stock_name,
        weight: row.weight ?? 0,
        returnPct,
        fill: treemapReturnColor(returnPct),
      };
    });
}

export function summarizeTreemapStats(holdings: TreemapHolding[]): TreemapStats {
  let up = 0;
  let down = 0;
  let flat = 0;

  for (const row of holdings) {
    if (row.returnPct == null) continue;
    if (row.returnPct > FLAT_THRESHOLD) up += 1;
    else if (row.returnPct < -FLAT_THRESHOLD) down += 1;
    else flat += 1;
  }

  return {
    count: holdings.length,
    up,
    down,
    flat,
    totalWeight: holdings.reduce((sum, row) => sum + row.weight, 0),
  };
}

export function latestPriceDate(priceMap: Record<string, StockPricePoint[]>): string | undefined {
  let latest: string | undefined;
  for (const points of Object.values(priceMap)) {
    const last = points[points.length - 1]?.date;
    if (last && (!latest || last > latest)) latest = last;
  }
  return latest;
}

export function formatTreemapDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}
