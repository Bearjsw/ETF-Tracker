import type { StockPricePoint } from "@/lib/types";
import { chartTrendColors, chartTrendPerfClass } from "@/lib/chart-trend-colors";
import { computePeriodReturn } from "@/lib/rankings";
import { formatPercent } from "@/lib/utils";

type Props = {
  data: StockPricePoint[];
  stockCode: string;
  width?: number;
  height?: number;
  showPerf?: boolean;
  fullWidth?: boolean;
  periodDays?: number;
  hideWhenEmpty?: boolean;
};

function trimPriceSeries(data: StockPricePoint[], periodDays: number): StockPricePoint[] {
  if (data.length < 2) return data;
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1].date;
  const start = new Date(latest);
  start.setDate(start.getDate() - periodDays);
  const startStr = start.toISOString().slice(0, 10);
  const trimmed = sorted.filter((p) => p.date >= startStr);
  return trimmed.length >= 2 ? trimmed : sorted;
}

/** Catmull-Rom → cubic bezier 변환으로 부드러운 곡선 path 생성 */
function smoothLinePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} L${points[1].x.toFixed(1)},${points[1].y.toFixed(1)}`;
  }
  const d = [`M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d.push(
      `C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`,
    );
  }
  return d.join(" ");
}

export function StockPriceSparkline({
  data,
  stockCode,
  width = 88,
  height = 32,
  showPerf = false,
  fullWidth = false,
  periodDays,
  hideWhenEmpty = false,
}: Props) {
  const isIntraday = data.some((p) => p.t != null);
  // 장중 데이터는 이미 기간이 한정돼 있으므로 trimming 없이 시간순 정렬만
  const sorted = isIntraday
    ? [...data].sort((a, b) => (a.t ?? 0) - (b.t ?? 0) || a.date.localeCompare(b.date))
    : periodDays
      ? trimPriceSeries(data, periodDays)
      : [...data].sort((a, b) => a.date.localeCompare(b.date));
  const chartWidth = fullWidth ? 240 : width;
  const chartHeight = fullWidth ? 72 : height;

  if (sorted.length < 2) {
    if (hideWhenEmpty) return null;
    return (
      <div
        className={
          fullWidth
            ? "flex h-[72px] w-full items-center justify-center rounded-lg bg-[#f0f2ef] text-xs text-[var(--muted)]"
            : "inline-flex h-8 w-[88px] items-center justify-center rounded-md bg-[#f0f2ef] text-[10px] text-[var(--muted)]"
        }
        title="주가 이력 없음"
      >
        —
      </div>
    );
  }

  const values = sorted.map((d) => d.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const perf = isIntraday
    ? values[0]
      ? ((values[values.length - 1] - values[0]) / values[0]) * 100
      : null
    : periodDays != null
      ? computePeriodReturn(
          data.map((p) => ({ date: p.date, value: p.close })),
          periodDays,
        )
      : sorted.length >= 2
        ? ((sorted[sorted.length - 1].close - sorted[0].close) / sorted[0].close) * 100
        : null;
  const up = (perf ?? 0) >= 0;
  const { stroke, fill } = chartTrendColors(up);

  // 시작가 기준선 (장중 변동을 직관적으로) — 가장 오래된 종가
  const baseValue = values[0];
  const baseY = chartHeight - 6 - ((baseValue - min) / range) * (chartHeight - 12);

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * chartWidth;
    const y = chartHeight - 6 - ((v - min) / range) * (chartHeight - 12);
    return { x, y };
  });

  const line = smoothLinePath(points);
  const area = `${line} L${chartWidth},${chartHeight} L0,${chartHeight} Z`;
  const last = points[points.length - 1];
  const safeCode = stockCode.replace(/\W/g, "");
  const gradientId = `spark-${safeCode}-${fullWidth ? "f" : "s"}-${up ? "u" : "d"}`;

  const svg = (
    <svg
      width={fullWidth ? "100%" : chartWidth}
      height={chartHeight}
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      preserveAspectRatio="none"
      className={fullWidth ? "block w-full" : "shrink-0"}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      {isIntraday ? (
        <line
          x1={0}
          y1={baseY}
          x2={chartWidth}
          y2={baseY}
          stroke={stroke}
          strokeWidth={1}
          strokeDasharray="3 3"
          strokeOpacity={0.35}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={fullWidth ? 1.75 : 1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last.x} cy={last.y} r={fullWidth ? 2.5 : 2} fill={stroke} stroke="#fff" strokeWidth={1} />
    </svg>
  );

  const title = isIntraday ? `${stockCode} 장중 추이` : `${stockCode} 주가 추이`;

  if (fullWidth) {
    return (
      <div className="w-full" title={title}>
        {svg}
        {showPerf && perf != null ? (
          <p className={`mt-1 text-right text-xs font-semibold tabular-nums ${chartTrendPerfClass(up)}`}>
            {formatPercent(perf, 1, true)}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5" title={title}>
      {svg}
      {showPerf && perf != null ? (
        <span className={`text-[10px] font-semibold tabular-nums ${chartTrendPerfClass(up)}`}>
          {formatPercent(perf, 1, true)}
        </span>
      ) : null}
    </div>
  );
}
