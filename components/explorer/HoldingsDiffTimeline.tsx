"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { HoldingDiff, HoldingDiffEnriched } from "@/lib/types";
import { DeltaBadge } from "@/components/explorer/DeltaBadge";
import { AssetClassTag } from "@/components/explorer/AssetClassTag";
import { StockLabel } from "@/components/explorer/StockLabel";
import { Pagination } from "@/components/ui/Pagination";
import {
  changeTypeBadgeClass,
  changeTypeDeltaClass,
  changeTypeLabel,
  formatKrw,
  formatNumber,
  formatPercent,
  formatRelativeChangeDate,
  isAccumulation,
} from "@/lib/utils";

const DEFAULT_PAGE_SIZE = 10;

type Props = {
  diffs: (HoldingDiff | HoldingDiffEnriched)[];
  title?: string;
  showEtf?: boolean;
  pageSize?: number;
  paginate?: boolean;
};

export function HoldingsDiffTimeline({
  diffs,
  title = "비중 변화 이력",
  showEtf = false,
  pageSize = DEFAULT_PAGE_SIZE,
  paginate = true,
}: Props) {
  const [page, setPage] = useState(1);
  const usePagination = paginate && diffs.length > pageSize;
  const totalPages = Math.max(1, Math.ceil(diffs.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const visibleDiffs = useMemo(
    () => (usePagination ? diffs.slice((safePage - 1) * pageSize, safePage * pageSize) : diffs),
    [diffs, usePagination, safePage, pageSize],
  );

  useEffect(() => {
    setPage(1);
  }, [diffs.length, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (!diffs.length) {
    return (
      <div className="card text-sm text-[var(--muted)]">
        {title} — 기록된 변화가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card overflow-x-auto">
        <h2 className="section-title mb-3">{title}</h2>
        <table className="timeline-table">
          <thead>
            <tr>
              <th>날짜</th>
              {showEtf ? <th>ETF</th> : null}
              <th>종목</th>
              <th>유형</th>
              <th>변화</th>
              <th>이전→현재</th>
              <th>추정 흐름</th>
              <th>수익</th>
            </tr>
          </thead>
          <tbody>
            {visibleDiffs.map((diff) => {
              const enriched = diff as HoldingDiffEnriched;
              const accumulating = isAccumulation(diff.change_type, diff.weight_delta);
              const perf = enriched.return_since_change;
              const changeTone = changeTypeDeltaClass(diff.change_type, diff.weight_delta);

              return (
                <tr key={`${diff.date}-${diff.etf_ticker}-${diff.stock_code}-${diff.change_type}`}>
                  <td className="timeline-date" title={diff.date}>
                    {formatRelativeChangeDate(diff.date)}
                  </td>
                  {showEtf ? (
                    <td className="timeline-stock">
                      <Link href={`/etfs/${diff.etf_ticker}`} className="hover:text-[var(--accent)]">
                        {enriched.etf_name ?? diff.etf_ticker}
                      </Link>
                    </td>
                  ) : null}
                  <td className="timeline-stock">
                    <div className="flex flex-wrap items-center gap-1">
                      <Link href={`/stocks/${diff.stock_code}`} className="font-medium hover:text-[var(--accent)]">
                        <StockLabel stockName={diff.stock_name} stockCode={diff.stock_code} />
                      </Link>
                      <AssetClassTag stockName={diff.stock_name} stockCode={diff.stock_code} />
                    </div>
                  </td>
                  <td>
                    <span className={`${changeTypeBadgeClass(diff.change_type)} text-[10px]`}>
                      {changeTypeLabel(diff.change_type)}
                    </span>
                  </td>
                  <td>
                    <DeltaBadge
                      delta={diff.weight_delta}
                      weightPrev={diff.weight_prev}
                      weightCurr={diff.weight_curr}
                      showRelative
                      size="sm"
                      toneClass={changeTone}
                    />
                  </td>
                  <td className="timeline-num text-[var(--muted)]">
                    {formatNumber(diff.weight_prev, 1)}→{formatNumber(diff.weight_curr, 1)}%
                  </td>
                  <td className={`timeline-num font-medium ${changeTone}`}>
                    {accumulating ? "+" : "−"}
                    {formatKrw(Math.abs(diff.est_flow_krw ?? 0))}
                  </td>
                  <td
                    className={`timeline-num font-medium ${
                      perf == null ? "text-[var(--muted)]" : perf >= 0 ? "delta-positive" : "delta-negative"
                    }`}
                  >
                    {perf != null ? formatPercent(perf, 1, true) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {usePagination ? (
        <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
      ) : null}
    </div>
  );
}
