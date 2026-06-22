"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { looksLikeOverseasStockName } from "@/lib/stock-ticker-resolve";
import type { EtfWeightSeries, StockPricePoint, WeightChartMarker } from "@/lib/types";
import { cn, formatNumber, formatShortDate, managerChartColor } from "@/lib/utils";

/** 차트 표시 구간 (~1개월 영업일) */
const CHART_POINT_LIMIT = 22;
const DEFAULT_VISIBLE_ETF_COUNT = 3;
const LEGEND_PREVIEW_COUNT = 10;

function buildDefaultHiddenEtfs(series: EtfWeightSeries[], visibleCount = DEFAULT_VISIBLE_ETF_COUNT): Set<string> {
  const sorted = [...series].sort((a, b) => {
    const aLast = a.points[a.points.length - 1]?.weight ?? 0;
    const bLast = b.points[b.points.length - 1]?.weight ?? 0;
    return bLast - aLast;
  });
  const hidden = new Set<string>();
  for (let i = visibleCount; i < sorted.length; i++) {
    hidden.add(sorted[i]!.etfTicker);
  }
  return hidden;
}

type Props = {
  stockCode: string;
  stockName: string;
  priceData: StockPricePoint[];
  weightSeries: EtfWeightSeries[];
  markers?: WeightChartMarker[];
  latestWeightDate?: string | null;
  /** 채권·CP 등 종가 시계열이 없는 자산 */
  showPriceChart?: boolean;
};

type ChartRow = Record<string, string | number | null>;

const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: "none",
  boxShadow: "0 4px 16px rgba(22, 51, 0, 0.1)",
  fontSize: 12,
  padding: "10px 12px",
};

function etfSeriesLabel(series: EtfWeightSeries): string {
  return series.etfName?.trim() || series.etfTicker;
}

function isNewEntryMarker(
  markers: WeightChartMarker[],
  date: string,
  etfTicker: string,
): boolean {
  return markers.some(
    (m) => m.date === date && m.etfTicker === etfTicker && m.changeType === "new",
  );
}

export function StockDualChart({
  stockCode,
  stockName,
  priceData,
  weightSeries,
  markers = [],
  latestWeightDate,
  showPriceChart = true,
}: Props) {
  const etfTickersKey = useMemo(
    () => weightSeries.map((s) => s.etfTicker).sort().join(","),
    [weightSeries],
  );

  const [hiddenEtfs, setHiddenEtfs] = useState<Set<string>>(() => buildDefaultHiddenEtfs(weightSeries));
  const [legendExpanded, setLegendExpanded] = useState(false);

  useEffect(() => {
    setHiddenEtfs(buildDefaultHiddenEtfs(weightSeries));
    setLegendExpanded(false);
  }, [stockCode, etfTickersKey, weightSeries]);
  const isOverseas = looksLikeOverseasStockName(stockName, stockCode);
  const priceFillId = `priceFill-${stockCode.replace(/\W/g, "")}`;

  const sortedEtfs = useMemo(
    () =>
      [...weightSeries].sort((a, b) => {
        const aLast = a.points[a.points.length - 1]?.weight ?? 0;
        const bLast = b.points[b.points.length - 1]?.weight ?? 0;
        return bLast - aLast;
      }),
    [weightSeries],
  );

  const etfLabelByTicker = useMemo(
    () => new Map(sortedEtfs.map((s) => [s.etfTicker, etfSeriesLabel(s)])),
    [sortedEtfs],
  );

  const chartData = useMemo(() => {
    const dates = new Set<string>();
    if (showPriceChart) {
      for (const p of priceData) dates.add(p.date);
    }
    for (const s of weightSeries) for (const p of s.points) dates.add(p.date);

    const priceMap = new Map(priceData.map((p) => [p.date, p.close]));
    const weightMaps = weightSeries.map((s) => ({
      etfTicker: s.etfTicker,
      map: new Map(s.points.map((p) => [p.date, p.weight])),
    }));

    return [...dates]
      .sort()
      .slice(-CHART_POINT_LIMIT)
      .map((date) => {
        const row: ChartRow = { date, close: priceMap.get(date) ?? null };
        for (const { etfTicker, map } of weightMaps) {
          row[etfTicker] = map.get(date) ?? null;
        }
        return row;
      });
  }, [priceData, weightSeries, showPriceChart]);

  const markerDates = useMemo(() => {
    const set = new Set<string>();
    for (const m of markers) {
      if (m.changeType === "new" || m.changeType === "weight_up") set.add(m.date);
    }
    return [...set].sort();
  }, [markers]);

  const latestClose = useMemo(() => {
    for (let i = chartData.length - 1; i >= 0; i -= 1) {
      const v = chartData[i]?.close;
      if (v != null) return Number(v);
    }
    return null;
  }, [chartData]);

  const visibleEtfCount = sortedEtfs.length - hiddenEtfs.size;
  const hasMoreLegend = sortedEtfs.length > LEGEND_PREVIEW_COUNT;
  const legendEtfs = legendExpanded ? sortedEtfs : sortedEtfs.slice(0, LEGEND_PREVIEW_COUNT);
  const hiddenLegendCount = sortedEtfs.length - LEGEND_PREVIEW_COUNT;

  if (!chartData.length) {
    return (
      <div className="card">
        <p className="text-sm text-[var(--muted)]">차트 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="stock-dual-chart">
      <div className="stock-dual-chart__header">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="section-title">{stockName}</h2>
            {showPriceChart ? (
              <span className="stock-dual-chart__pill">{isOverseas ? "USD" : "KRW"}</span>
            ) : null}
          </div>
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            ETF별 편입 비중 · 최근 1개월
            {latestWeightDate ? (
              <span className="text-[var(--foreground)]"> · {formatShortDate(latestWeightDate)} 기준</span>
            ) : null}
          </p>
        </div>
        {showPriceChart && latestClose != null ? (
          <div className="stock-dual-chart__price-stat">
            <span className="text-label">종가</span>
            <span className="text-stat mt-0.5 text-xl">
              {isOverseas ? `$${formatNumber(latestClose, 2)}` : `${formatNumber(latestClose, 0)}원`}
            </span>
          </div>
        ) : null}
      </div>

      {showPriceChart ? (
      <div className="stock-dual-chart__panel">
        <p className="stock-dual-chart__panel-label">종가 {isOverseas ? "(USD)" : ""}</p>
        <div className="stock-dual-chart__chart stock-dual-chart__chart--price">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={priceFillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#163300" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#163300" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e2e8e0" strokeDasharray="3 3" vertical={false} />
              {markerDates.map((date, i) => (
                <ReferenceArea
                  key={date}
                  x1={date}
                  x2={date}
                  fill={i % 2 === 0 ? "#e8f8e1" : "#f3f4f6"}
                  fillOpacity={0.65}
                />
              ))}
              <XAxis dataKey="date" hide />
              <YAxis
                tick={{ fontSize: 11, fill: "#8a9a8e" }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v) =>
                  isOverseas ? `$${formatNumber(Number(v), 0)}` : `${formatNumber(Number(v) / 10000, 0)}만`
                }
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v) => [
                  isOverseas
                    ? `$${formatNumber(Number(v ?? 0), 2)}`
                    : `${formatNumber(Number(v ?? 0), 0)}원`,
                  "종가",
                ]}
                labelFormatter={(l) => formatShortDate(String(l))}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke="#163300"
                strokeWidth={2}
                fill={`url(#${priceFillId})`}
                connectNulls
                dot={false}
                activeDot={{ r: 4, fill: "#163300", stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      ) : null}

      <div className={cn("stock-dual-chart__panel stock-dual-chart__panel--weight", !showPriceChart && "stock-dual-chart__panel--weight-only")}>
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <p className="stock-dual-chart__panel-label">ETF별 포트폴리오 비중</p>
          <span className="text-xs font-medium text-[var(--muted-foreground)]">
            {visibleEtfCount}/{sortedEtfs.length}개 표시
          </span>
        </div>

        <div className="stock-dual-chart__legend">
          {legendEtfs.map((s) => {
            const index = sortedEtfs.findIndex((item) => item.etfTicker === s.etfTicker);
            const hidden = hiddenEtfs.has(s.etfTicker);
            const color = managerChartColor(index >= 0 ? index : 0);
            const label = etfSeriesLabel(s);
            return (
              <button
                key={s.etfTicker}
                type="button"
                aria-pressed={!hidden}
                title={s.etfTicker}
                onClick={() =>
                  setHiddenEtfs((prev) => {
                    const next = new Set(prev);
                    if (next.has(s.etfTicker)) next.delete(s.etfTicker);
                    else next.add(s.etfTicker);
                    return next;
                  })
                }
                className={cn(
                  "manager-legend-chip",
                  hidden && "manager-legend-chip--off",
                  !hidden && "manager-legend-chip--active",
                )}
              >
                <span className="manager-legend-chip__dot" style={{ background: color }} />
                <span className="manager-legend-chip__label">{label}</span>
              </button>
            );
          })}
          {hasMoreLegend && !legendExpanded ? (
            <button
              type="button"
              className="manager-legend-expand"
              aria-label="더보기"
              onClick={() => setLegendExpanded(true)}
            >
              <span className="manager-legend-expand__icon" aria-hidden>
                ›
              </span>
              <span>더보기</span>
            </button>
          ) : null}
          {hasMoreLegend && legendExpanded ? (
            <button
              type="button"
              className="manager-legend-expand manager-legend-expand--collapse"
              aria-label="ETF 목록 접기"
              onClick={() => setLegendExpanded(false)}
            >
              <span className="manager-legend-expand__icon" aria-hidden>
                ‹
              </span>
              <span>접기</span>
            </button>
          ) : null}
        </div>

        <div className="stock-dual-chart__chart stock-dual-chart__chart--weight">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8e0" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#8a9a8e" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatShortDate(String(v))}
                minTickGap={32}
                dy={6}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#8a9a8e" }}
                axisLine={false}
                tickLine={false}
                width={40}
                tickFormatter={(v) => `${formatNumber(Number(v), 1)}%`}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v, name) => [
                  `${formatNumber(Number(v ?? 0), 2)}%`,
                  etfLabelByTicker.get(String(name)) ?? String(name),
                ]}
                labelFormatter={(l) => formatShortDate(String(l))}
              />
              {sortedEtfs.map((s, i) => {
                if (hiddenEtfs.has(s.etfTicker)) return null;
                const color = managerChartColor(i);
                return (
                  <Line
                    key={s.etfTicker}
                    type="monotone"
                    dataKey={s.etfTicker}
                    stroke={color}
                    strokeWidth={2}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      if (cx == null || cy == null || !payload?.date) return <g />;
                      if (!isNewEntryMarker(markers, String(payload.date), s.etfTicker)) return <g />;
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={5}
                          fill={color}
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      );
                    }}
                    activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {markerDates.length > 0 ? (
          <p className="stock-dual-chart__footnote">
            <span className="stock-dual-chart__footnote-dot" />
            채운 점 = 해당 ETF 신규 편입 · {stockCode}
          </p>
        ) : null}
      </div>
    </div>
  );
}
