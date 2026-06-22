"use client";

import { useState, type ReactNode } from "react";
import { StockFlowCard } from "@/components/explorer/StockFlowCard";
import type { StockFlowSort, StockFlowSummary, StockPricePoint } from "@/lib/types";
import { returnPeriodLabel, stockFlowSortLabel } from "@/lib/rankings";
import type { ReturnPeriod } from "@/lib/types";
import { ChevronIcon } from "@/components/ui/ChevronIcon";

const DEFAULT_VISIBLE = 10;

type Props = {
  flows: StockFlowSummary[];
  priceByStock?: Record<string, StockPricePoint[]>;
  title?: string;
  sort?: StockFlowSort;
  period?: ReturnPeriod;
  /** false면 처음부터 전체 순위 표시 (홈 등) */
  collapseAfter?: number | null;
  layout?: "list" | "grid";
  headerAction?: ReactNode;
};

export function StockFlowList({
  flows,
  priceByStock = {},
  title = "매수·매도 활발 종목",
  sort = "turnover",
  period = "3m",
  collapseAfter = DEFAULT_VISIBLE,
  layout = "list",
  headerAction,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const collapseLimit = collapseAfter ?? flows.length;
  const canCollapse = collapseAfter != null && flows.length > collapseLimit;
  const visibleFlows = !canCollapse || expanded ? flows : flows.slice(0, collapseLimit);
  const hiddenCount = canCollapse ? Math.max(0, flows.length - collapseLimit) : 0;

  if (!flows.length) {
    const emptyHint =
      sort === "net_sell"
        ? "순매도(비중 축소·편출) 기록이 아직 없습니다. 현재 DB에는 매수·편입 위주 데이터만 있습니다."
        : sort === "net_buy"
          ? "순매수 기록이 있는 종목이 없습니다."
          : sort === "surge" || sort === "drop"
            ? "주가 이력이 있는 종목이 없습니다. collect_stock_prices.py 실행이 필요할 수 있습니다."
            : "표시할 매매 흐름 데이터가 없습니다.";

    return (
      <div className="card">
        <h2 className="section-title mb-2">{title}</h2>
        <p className="text-sm text-[var(--muted)]">
          {emptyHint}{" "}
          운용사 필터가 켜져 있다면{" "}
          <span className="font-medium text-[var(--foreground)]">초기화</span>를 눌러 보세요.
        </p>
      </div>
    );
  }

  const subtitle = `${stockFlowSortLabel(sort)} · ${returnPeriodLabel(period)}`;

  const listClass = layout === "grid" ? "stock-flow-grid" : "space-y-3";

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">정렬: {subtitle}</p>
        </div>
        {headerAction}
      </div>
      <div className={listClass}>
        {visibleFlows.map((flow, index) => (
          <StockFlowCard
            key={flow.stock_code}
            flow={flow}
            index={index}
            sort={sort}
            period={period}
            priceByStock={priceByStock}
            variant={layout}
          />
        ))}
      </div>
      {hiddenCount > 0 ? (
        <button
          type="button"
          className="btn-ghost flex w-full items-center justify-center gap-1.5 text-sm"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "접기" : "더보기"}
        >
          {expanded ? (
            <>
              <ChevronIcon direction="left" size={16} />
              <span className="text-[var(--muted)]">접기</span>
            </>
          ) : (
            <>
              <ChevronIcon direction="right" size={16} />
              <span className="text-[var(--muted)]">더보기</span>
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}
