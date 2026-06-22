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
  const sorted = periodDays ? trimPriceSeries(data, periodDays) : [...data].sort((a, b) => a.date.localeCompare(b.date));
  const chartWidth = fullWidth ? 200 : width;
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
  const perf =
    periodDays != null
      ? computePeriodReturn(
          data.map((p) => ({ date: p.date, value: p.close })),
          periodDays,
        )
      : sorted.length >= 2
        ? ((sorted[sorted.length - 1].close - sorted[0].close) / sorted[0].close) * 100
        : null;
  const up = (perf ?? 0) >= 0;
  const { stroke, fill } = chartTrendColors(up);

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * chartWidth;
    const y = chartHeight - 6 - ((v - min) / range) * (chartHeight - 12);
    return { x, y };
  });

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${chartWidth},${chartHeight} L0,${chartHeight} Z`;

  const svg = (
    <svg
      width={fullWidth ? "100%" : chartWidth}
      height={chartHeight}
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      preserveAspectRatio="none"
      className={fullWidth ? "block w-full" : "shrink-0"}
      aria-hidden
    >
      <path d={area} fill={fill} fillOpacity={0.35} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  if (fullWidth) {
    return (
      <div className="w-full" title={`${stockCode} 주가 추이`}>
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
    <div className="inline-flex items-center gap-1.5" title={`${stockCode} 3달 주가 추이`}>
      {svg}
      {showPerf && perf != null ? (
        <span className={`text-[10px] font-semibold tabular-nums ${chartTrendPerfClass(up)}`}>
          {formatPercent(perf, 1, true)}
        </span>
      ) : null}
    </div>
  );
}
