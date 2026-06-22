"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PriceRange, StockPricePoint } from "@/lib/types";
import { chartTrendColors, chartTrendPerfClass } from "@/lib/chart-trend-colors";
import { formatNumber, formatPercent } from "@/lib/utils";

type Props = {
  stockCode: string;
  stockName: string;
  data: StockPricePoint[];
};

const RANGES: { key: PriceRange; label: string; days: number }[] = [
  { key: "1m", label: "1달", days: 30 },
  { key: "3m", label: "3달", days: 90 },
  { key: "1y", label: "1년", days: 365 },
  { key: "all", label: "전체", days: 9999 },
];

export function StockPriceChart({ stockCode, stockName, data }: Props) {
  const [range, setRange] = useState<PriceRange>("3m");

  const sorted = useMemo(
    () => [...data].sort((a, b) => a.date.localeCompare(b.date)),
    [data],
  );

  const filtered = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)?.days ?? 90;
    if (days >= 9999 || !sorted.length) return sorted;
    const cutoff = sorted[sorted.length - 1]?.date;
    if (!cutoff) return sorted;
    const end = new Date(cutoff);
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    const startStr = start.toISOString().slice(0, 10);
    return sorted.filter((p) => p.date >= startStr);
  }, [sorted, range]);

  const performance = useMemo(() => {
    if (filtered.length < 2) return null;
    const first = filtered[0].close;
    const last = filtered[filtered.length - 1].close;
    if (!first) return null;
    return ((last - first) / first) * 100;
  }, [filtered]);

  const latest = filtered[filtered.length - 1];
  const chartUp = (performance ?? 0) >= 0;
  const { stroke: chartStroke, fill: chartFill } = chartTrendColors(chartUp);

  if (!sorted.length) {
    return (
      <div className="card">
        <h2 className="section-title mb-2">주가 추이</h2>
        <p className="text-sm text-[var(--muted)]">아직 주가 이력이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="section-title">주가 추이</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {stockName} ({stockCode})
            {latest ? (
              <span className="ml-2 font-semibold text-[var(--foreground)]">
                최신 {formatNumber(latest.close, 0)}원
                {performance != null ? (
                  <span className={chartTrendPerfClass(chartUp)}>
                    {" "}
                    ({formatPercent(performance, 2, true)})
                  </span>
                ) : null}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex rounded-full bg-[#f7f8f5] p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                range === r.key
                  ? "bg-[var(--accent-bright)] text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filtered} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="stockFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartFill} stopOpacity={0.45} />
                <stop offset="100%" stopColor={chartFill} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e2e8e0" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#5d6b5f" }}
              tickFormatter={(v) => String(v).slice(5)}
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#5d6b5f" }}
              width={64}
              domain={["auto", "auto"]}
              tickFormatter={(v) => formatNumber(v, 0)}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 10,
                border: "none",
                boxShadow: "0 4px 16px rgba(22,51,0,0.08)",
              }}
              formatter={(value) => [`${formatNumber(Number(value ?? 0), 0)}원`, "종가"]}
              labelFormatter={(label) => `기준일 ${label}`}
            />
            <Area type="monotone" dataKey="close" stroke={chartStroke} strokeWidth={2} fill="url(#stockFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
