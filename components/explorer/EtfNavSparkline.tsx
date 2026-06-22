import type { EtfNavPoint } from "@/lib/types";
import { chartTrendColors, chartTrendPerfClass } from "@/lib/chart-trend-colors";
import { navSeriesPerf, sanitizeNavSeries, trimNavSeriesToDays } from "@/lib/nav-series";
import { formatPercent } from "@/lib/utils";

type Props = {
  data: EtfNavPoint[];
  ticker: string;
  width?: number;
  height?: number;
  showPerf?: boolean;
  /** 설정 시 표·스파크라인 수익률을 동일 기간으로 맞춤 */
  periodDays?: number;
};

export function EtfNavSparkline({
  data,
  ticker,
  width = 88,
  height = 32,
  showPerf = false,
  periodDays,
}: Props) {
  const sorted = periodDays ? trimNavSeriesToDays(data, periodDays) : sanitizeNavSeries(data);

  if (sorted.length < 2) {
    return (
      <div
        className="inline-flex h-8 w-[88px] items-center justify-center rounded-md bg-[#f0f2ef] text-[10px] text-[var(--muted)]"
        title="NAV 이력 없음"
      >
        —
      </div>
    );
  }

  const values = sorted.map((d) => d.nav);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const perf = navSeriesPerf(data, periodDays);
  const up = (perf ?? 0) >= 0;
  const { stroke, fill } = chartTrendColors(up);

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - 4 - ((v - min) / range) * (height - 8);
    return { x, y };
  });

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <div className="inline-flex items-center gap-1.5" title={`${ticker} 시장 종가 추이`}>
      <svg width={width} height={height} className="shrink-0" aria-hidden>
        <path d={area} fill={fill} fillOpacity={0.35} />
        <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {showPerf && perf != null ? (
        <span className={`text-[10px] font-semibold tabular-nums ${chartTrendPerfClass(up)}`}>
          {formatPercent(perf, 1, true)}
        </span>
      ) : null}
    </div>
  );
}
