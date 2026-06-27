"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { HoldingDaily } from "@/lib/types";
import { latestHoldingsSorted } from "@/lib/holdings";
import { getStockChartColor } from "@/lib/stock-colors";
import { WeightBar } from "@/components/explorer/WeightBar";
import { AssetClassTag } from "@/components/explorer/AssetClassTag";
import { StockLogo } from "@/components/explorer/Logo";
import { StockLabel } from "@/components/explorer/StockLabel";
import { ChevronIcon } from "@/components/ui/ChevronIcon";
import { formatNumber } from "@/lib/utils";

const DEFAULT_VISIBLE = 5;
const LOAD_MORE_SIZE = 10;
const DEFAULT_LOGO_SIZE = 48;

type Props = {
  holdings: HoldingDaily[];
  etfName: string;
  logoSize?: number;
};

export function TopHoldingsCard({ holdings, etfName, logoSize = DEFAULT_LOGO_SIZE }: Props) {
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE);
  const allRows = useMemo(() => latestHoldingsSorted(holdings), [holdings]);
  const latestDate = allRows[0]?.date;
  const maxWeight = allRows[0]?.weight ?? 15;
  const visibleRows = allRows.slice(0, visibleCount);
  const remaining = Math.max(0, allRows.length - visibleCount);
  const canLoadMore = remaining > 0;
  const canCollapse = visibleCount > DEFAULT_VISIBLE;

  if (!allRows.length) {
    return (
      <div className="card">
        <h2 className="section-title">주요 보유종목</h2>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {etfName}의 구성종목·비중 데이터가 아직 없습니다.{" "}
          <code className="code-inline">python scripts/collect_daily.py</code> 실행 후
          이 영역에 상위 종목과 비중이 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="section-title">주요 보유종목</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            비중 상위 {DEFAULT_VISIBLE}개 · 클릭하면 종목 상세로 이동합니다.
          </p>
        </div>
        {latestDate ? <span className="text-xs text-[var(--muted)]">기준일 {latestDate}</span> : null}
      </div>
      <ol className="space-y-3">
        {visibleRows.map((row, index) => {
          const color = getStockChartColor(row.stock_code, row.stock_name, index);
          return (
            <li key={row.stock_code} className="list-row flex items-center gap-3">
              <span className="w-5 shrink-0 text-center text-xs font-semibold text-[var(--muted)]">
                {index + 1}
              </span>
              <StockLogo
                stockName={row.stock_name}
                stockCode={row.stock_code}
                size={logoSize}
                variant="circle"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <Link
                    href={`/stocks/${row.stock_code}`}
                    className="truncate text-sm font-medium text-[var(--accent)] hover:underline"
                  >
                    <StockLabel stockName={row.stock_name} stockCode={row.stock_code} />
                  </Link>
                  <AssetClassTag stockName={row.stock_name} stockCode={row.stock_code} />
                  <span className="text-[11px] text-[var(--muted)]">{row.stock_code}</span>
                </div>
                <WeightBar
                  weight={row.weight}
                  maxWeight={maxWeight}
                  className="mt-1.5"
                  variant="positive"
                  accentColor={color}
                  showLabel={false}
                />
              </div>
              <div className="shrink-0 text-right">
                <span className="text-sm font-semibold tabular-nums">{formatNumber(row.weight, 2)}%</span>
                <div className="text-[11px] text-[var(--muted)]">수량 {formatNumber(row.quantity)}</div>
              </div>
            </li>
          );
        })}
      </ol>
      {canLoadMore || canCollapse ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {canLoadMore ? (
            <button
              type="button"
              className="btn-ghost flex flex-1 items-center justify-center gap-1.5 text-sm"
              onClick={() =>
                setVisibleCount((c) => Math.min(c + LOAD_MORE_SIZE, allRows.length))
              }
              aria-label="더보기"
            >
              <ChevronIcon direction="right" size={16} />
              <span className="text-[var(--muted)]">더보기</span>
            </button>
          ) : null}
          {canCollapse ? (
            <button
              type="button"
              className="btn-ghost flex items-center justify-center gap-1.5 text-sm sm:w-auto sm:px-4"
              onClick={() => setVisibleCount(DEFAULT_VISIBLE)}
              aria-label="상위 5개만 보기"
            >
              <ChevronIcon direction="left" size={16} />
              <span className="text-[var(--muted)]">접기</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
