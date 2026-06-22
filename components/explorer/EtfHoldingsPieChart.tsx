"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { HoldingDaily } from "@/lib/types";
import { buildHoldingsPieSlices } from "@/lib/holdings-chart";
import { getLatestHoldingsDate } from "@/lib/holdings";
import { formatNumber } from "@/lib/utils";

type Props = {
  holdings: HoldingDaily[];
  etfName: string;
  topN?: number;
};

type TooltipPayload = {
  name: string;
  value: number;
  payload: { stock_code: string; name: string; weight: number; isOther?: boolean };
};

function PieTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-semibold">{item.name}</p>
      <p className="mt-0.5 tabular-nums text-[var(--muted)]">{formatNumber(item.weight, 2)}%</p>
    </div>
  );
}

export function EtfHoldingsPieChart({ holdings, etfName, topN = 5 }: Props) {
  const latestDate = getLatestHoldingsDate(holdings);
  const slices = useMemo(() => buildHoldingsPieSlices(holdings, topN), [holdings, topN]);
  const totalWeight = useMemo(() => slices.reduce((s, row) => s + row.weight, 0), [slices]);

  if (!slices.length) {
    return (
      <div className="card">
        <h2 className="section-title mb-2">보유종목 비중</h2>
        <p className="text-sm text-[var(--muted)]">
          {etfName}의 구성종목·비중 데이터가 아직 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="section-title">보유종목 비중</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            상위 {Math.min(topN, slices.filter((s) => !s.isOther).length)}개 + 기타 · 합계{" "}
            {formatNumber(totalWeight, 1)}%
          </p>
        </div>
        {latestDate ? <span className="text-xs text-[var(--muted)]">기준일 {latestDate}</span> : null}
      </div>

      <div className="holdings-pie-layout">
        <div className="holdings-pie-chart">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={slices}
                dataKey="weight"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={108}
                paddingAngle={1.5}
                stroke="none"
              >
                {slices.map((slice) => (
                  <Cell key={slice.stock_code} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="holdings-pie-legend">
          {slices.map((slice) => (
            <li key={slice.stock_code} className="holdings-pie-legend-item">
              <span className="holdings-pie-swatch" style={{ background: slice.color }} />
              {slice.isOther ? (
                <span className="min-w-0 flex-1 truncate text-sm">{slice.name}</span>
              ) : (
                <Link
                  href={`/stocks/${slice.stock_code}`}
                  className="min-w-0 flex-1 truncate text-sm font-medium hover:text-[var(--accent)]"
                >
                  {slice.name}
                </Link>
              )}
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatNumber(slice.weight, 2)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
