"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EtfNavPoint } from "@/lib/types";
import { chartTrendColors, chartTrendPerfClass } from "@/lib/chart-trend-colors";
import { navSeriesPerf, sanitizeNavSeries } from "@/lib/nav-series";
import { formatNumber, formatPercent } from "@/lib/utils";

type Props = {
  ticker: string;
  data: EtfNavPoint[];
};

export function EtfPriceChart({ ticker, data }: Props) {
  const series = useMemo(() => sanitizeNavSeries(data), [data]);
  const performance = useMemo(() => navSeriesPerf(series), [series]);

  const latest = series[series.length - 1];
  const chartUp = (performance ?? 0) >= 0;
  const { stroke: chartStroke, fill: chartFill } = chartTrendColors(chartUp);

  if (!series.length) {
    return (
      <div className="card">
        <h2 className="section-title mb-2">시장 종가 추이</h2>
        <p className="text-sm text-[var(--muted)]">아직 NAV 이력이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-4">
        <h2 className="section-title">시장 종가 추이</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          FinanceDataReader 시장 종가 기준 · 공식 NAV와 다를 수 있음
          {latest ? (
            <span className="ml-2 font-semibold text-[var(--foreground)]">
              최신 {formatNumber(latest.nav, 0)}
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
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`navFill-${ticker}`} x1="0" y1="0" x2="0" y2="1">
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
              width={56}
              domain={["auto", "auto"]}
              tickFormatter={(v) => formatNumber(v, 0)}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 10,
                border: "none",
                boxShadow: "0 4px 16px rgba(22,51,0,0.08)",
              }}
              formatter={(value) => [formatNumber(Number(value ?? 0), 2), "NAV"]}
              labelFormatter={(label) => `기준일 ${label}`}
            />
            <Area
              type="monotone"
              dataKey="nav"
              stroke={chartStroke}
              strokeWidth={2}
              fill={`url(#navFill-${ticker})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
