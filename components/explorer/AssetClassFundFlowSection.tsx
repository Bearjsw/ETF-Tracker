"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EtfCategoryTag } from "@/components/explorer/EtfCategoryTag";
import { ChevronIcon } from "@/components/ui/ChevronIcon";
import type { EtfAssetClassId } from "@/lib/etf-asset-class";
import { FUND_FLOW_CLASS_COLORS } from "@/lib/fund-flow-colors";
import type { AssetClassFundFlowReport } from "@/lib/types";
import { formatKrw, formatManagerShort } from "@/lib/utils";

type Props = {
  report: AssetClassFundFlowReport;
  manager?: string;
  compact?: boolean;
};

function formatFlowAxis(value: number) {
  const abs = Math.abs(value);
  if (abs >= 10000) return `${(value / 10000).toFixed(0)}조`;
  if (abs >= 1) return `${value.toFixed(0)}억`;
  return `${(value * 10000).toFixed(0)}만`;
}

function formatAumAxis(value: number) {
  return `${value.toFixed(1)}조`;
}

function formatFlowCell(valueInEok: number) {
  if (valueInEok === 0) return "—";
  const sign = valueInEok > 0 ? "+" : "";
  if (Math.abs(valueInEok) >= 10000) return `${sign}${(valueInEok / 10000).toFixed(1)}조`;
  return `${sign}${Math.round(valueInEok).toLocaleString("ko-KR")}`;
}

export function AssetClassFundFlowSection({
  report,
  manager,
  compact = false,
}: Props) {
  const [tableOpen, setTableOpen] = useState(false);

  const activeClasses = useMemo(
    () =>
      report.assetClassOrder.filter(
        (c) =>
          report.weekly.some((w) => w.flows[c] !== 0) ||
          report.cumulativeByClass[c] !== 0,
      ),
    [report],
  );

  const chartData = useMemo(
    () =>
      report.weekly.map((w) => {
        const row: Record<string, string | number> = {
          weekLabel: w.weekLabel,
          weekEnd: w.weekEnd,
          marketAum: w.marketAum / 1_0000_0000_0000,
        };
        for (const c of activeClasses) {
          row[c] = w.flows[c] / 1_0000_0000;
        }
        return row;
      }),
    [report.weekly, activeClasses],
  );

  if (!report.hasShareData || !report.weekly.length) {
    return (
      <section className="card text-sm text-[var(--muted)]">
        <h2 className="section-title mb-2">ETF 자금흐름</h2>
        <p>
          Δ상장좌수×NAV 데이터가 아직 없습니다.{" "}
          <code className="text-xs">collect_daily.py</code> 실행 후 표시됩니다.
        </p>
      </section>
    );
  }

  const chartHeight = compact ? 168 : 220;
  const barCategoryGap = compact ? "6%" : "12%";
  const maxBarSize = compact ? 36 : 32;

  return (
    <section className={`card ${compact ? "fund-flow-card--compact space-y-3" : "space-y-4"}`}>
      <div className="fund-flow-head">
        <h2 className="section-title shrink-0">ETF 자금흐름</h2>
        <div className="fund-flow-head__end">
          <p className="fund-flow-head__meta text-xs text-[var(--muted)]">
            Δ좌수×NAV · {report.weeks}주
            {report.asOfDate ? ` · ${report.asOfDate}` : null}
            {manager ? ` · ${manager}` : null}
          </p>
          {compact ? (
            <Link
              href="/market"
              className="fund-flow-head__link shrink-0 text-xs font-semibold text-[var(--accent)] hover:underline"
            >
              전체 보기
            </Link>
          ) : null}
        </div>
      </div>

      <div className="fund-flow-stat">
        <p className="text-label">순유입 합계</p>
        <p
          className={`text-stat tabular-nums ${report.total12WeekNetFlow >= 0 ? "delta-positive" : "delta-negative"}`}
        >
          {formatKrw(report.total12WeekNetFlow)}
        </p>
      </div>

      <div className={compact ? "space-y-2.5" : "space-y-4"}>
          <div className={`fund-flow-chart-wrap ${compact ? "fund-flow-chart-wrap--compact" : ""}`}>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <ComposedChart
                data={chartData}
                stackOffset="sign"
                barCategoryGap={barCategoryGap}
                barGap={compact ? 1 : 2}
                margin={compact ? { top: 2, right: 4, left: 0, bottom: 0 } : { top: 8, right: 8, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e4" vertical={false} />
                <XAxis
                  dataKey="weekLabel"
                  tick={{ fontSize: compact ? 10 : 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  padding={compact ? { left: 4, right: 4 } : { left: 8, right: 8 }}
                />
                <YAxis
                  yAxisId="flow"
                  tickFormatter={formatFlowAxis}
                  tick={{ fontSize: compact ? 9 : 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <YAxis
                  yAxisId="aum"
                  orientation="right"
                  tickFormatter={formatAumAxis}
                  tick={{ fontSize: compact ? 9 : 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const weekEnd = payload[0]?.payload?.weekEnd as string | undefined;
                    return (
                      <div className="fund-flow-tooltip">
                        <p className="font-semibold">
                          {label}
                          {weekEnd ? ` (${weekEnd})` : ""}
                        </p>
                        {payload.map((p) => {
                          const key = String(p.dataKey);
                          if (key === "marketAum") {
                            return (
                              <p key={key} className="text-[var(--muted)]">
                                시장 규모 {Number(p.value).toFixed(2)}조
                              </p>
                            );
                          }
                          const cls = key as EtfAssetClassId;
                          return (
                            <p key={key} style={{ color: FUND_FLOW_CLASS_COLORS[cls] }}>
                              {report.assetClassLabels[cls]} {formatKrw(Number(p.value) * 1_0000_0000)}
                            </p>
                          );
                        })}
                      </div>
                    );
                  }}
                />
                {activeClasses.map((c) => (
                  <Bar
                    key={c}
                    yAxisId="flow"
                    dataKey={c}
                    stackId="flow"
                    fill={FUND_FLOW_CLASS_COLORS[c]}
                    maxBarSize={maxBarSize}
                    radius={[1, 1, 0, 0]}
                  />
                ))}
                <Line
                  yAxisId="aum"
                  type="monotone"
                  dataKey="marketAum"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className={compact ? "fund-flow-legend fund-flow-legend--compact" : "fund-flow-legend flex flex-wrap gap-2"}>
            {activeClasses.map((c) => {
              const cum = report.cumulativeByClass[c] / 1_0000_0000;
              return (
                <span
                  key={c}
                  className={compact ? "market-slice-pill market-slice-pill--sm" : "market-slice-pill"}
                >
                  <span className="fund-flow-legend-dot" style={{ background: FUND_FLOW_CLASS_COLORS[c] }} />
                  <EtfCategoryTag assetClass={c} />
                  <span
                    className={`market-slice-pill__pct ${compact ? "text-xs" : ""} ${cum >= 0 ? "delta-positive" : "delta-negative"}`}
                  >
                    {formatFlowCell(cum)}
                  </span>
                </span>
              );
            })}
          </div>

          {!compact ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <FlowLeaderPanel title="순유입 TOP" rows={report.topInflow} positive />
                <FlowLeaderPanel title="순유출 TOP" rows={report.topOutflow} positive={false} />
              </div>

              <button
                type="button"
                className="fund-flow-table-toggle"
                onClick={() => setTableOpen((v) => !v)}
                aria-expanded={tableOpen}
              >
                <ChevronIcon
                  direction="right"
                  className={`h-3.5 w-3.5 transition-transform ${tableOpen ? "rotate-90" : ""}`}
                />
                주간·누적 표 {tableOpen ? "접기" : "보기"}
              </button>

              {tableOpen ? (
                <div className="fund-flow-table-scroll">
                  <table className="fund-flow-table">
                    <thead>
                      <tr>
                        <th>자산군</th>
                        {report.weekly.map((w) => (
                          <th key={w.weekEnd}>{w.weekLabel}</th>
                        ))}
                        <th>누적</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeClasses.map((c) => (
                        <tr key={c}>
                          <td>
                            <EtfCategoryTag assetClass={c} />
                          </td>
                          {report.weekly.map((w) => {
                            const v = w.flows[c] / 1_0000_0000;
                            return (
                              <td
                                key={w.weekEnd}
                                className={v > 0 ? "delta-positive" : v < 0 ? "delta-negative" : ""}
                              >
                                {v === 0 ? "—" : formatFlowCell(v)}
                              </td>
                            );
                          })}
                          <td
                            className={
                              report.cumulativeByClass[c] >= 0 ? "delta-positive" : "delta-negative"
                            }
                          >
                            {formatFlowCell(report.cumulativeByClass[c] / 1_0000_0000)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
    </section>
  );
}

function FlowLeaderPanel({
  title,
  rows,
  positive,
}: {
  title: string;
  rows: AssetClassFundFlowReport["topInflow"];
  positive: boolean;
}) {
  if (!rows.length) {
    return (
      <div className="etf-flow-panel">
        <h3 className="etf-flow-panel__title">{title}</h3>
        <p className="text-xs text-[var(--muted)]">데이터 없음</p>
      </div>
    );
  }

  return (
    <div className="etf-flow-panel">
      <h3 className="etf-flow-panel__title">{title}</h3>
      <ol className="etf-flow-leader-list">
        {rows.map((row, i) => (
          <li key={row.ticker} className="etf-flow-leader-list__item">
            <span className="etf-flow-leader-list__rank">{i + 1}</span>
            <div className="etf-flow-leader-list__main">
              <Link href={`/etfs/${row.ticker}`} className="etf-flow-leader-list__name">
                {row.name}
              </Link>
              <div className="etf-flow-leader-list__meta">
                <EtfCategoryTag assetClass={row.asset_class} />
                {row.manager ? (
                  <span className="etf-flow-leader-list__manager">{formatManagerShort(row.manager)}</span>
                ) : null}
              </div>
            </div>
            <span className={`etf-flow-leader-list__amt ${positive ? "delta-positive" : "delta-negative"}`}>
              {positive ? "+" : "−"}
              {formatKrw(Math.abs(row.net_flow_krw))}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
