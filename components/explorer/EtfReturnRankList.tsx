"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { EtfReturnRankItem, EtfNavPoint } from "@/lib/types";
import { EtfCategoryTag } from "@/components/explorer/EtfCategoryTag";
import { EtfNavSparkline } from "@/components/explorer/EtfNavSparkline";
import { Pagination } from "@/components/ui/Pagination";
import { periodToDays, returnPeriodLabel } from "@/lib/rankings";
import type { ReturnPeriod } from "@/lib/types";
import { formatKrw, formatManagerShort, formatPercent, strategyLabel } from "@/lib/utils";

type Props = {
  items: EtfReturnRankItem[];
  navByTicker?: Record<string, EtfNavPoint[]>;
  period?: ReturnPeriod;
  hideHeader?: boolean;
  /** 순위 테이블에 미니 차트 열 표시 (액티브 ETF 목록 등에서는 생략) */
  showSparkline?: boolean;
  /** 지정 시 페이지당 항목 수로 페이지네이션 활성화 */
  pageSize?: number;
};

export function EtfReturnRankList({
  items,
  navByTicker = {},
  period = "1w",
  hideHeader = false,
  showSparkline = true,
  pageSize,
}: Props) {
  const [page, setPage] = useState(1);
  const paginate = pageSize != null && pageSize > 0;
  const totalPages = paginate ? Math.max(1, Math.ceil(items.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages);
  const rankOffset = paginate ? (safePage - 1) * pageSize : 0;
  const visibleItems = paginate ? items.slice(rankOffset, rankOffset + pageSize) : items;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (!items.length) {
    return (
      <div className="card text-sm text-[var(--muted)]">
        NAV 이력이 있는 ETF가 없습니다.{" "}
        <code className="code-inline">python scripts/collect_etf_nav_history.py --all-crawl --limit 600</code>{" "}
        실행 후 다시 확인해 보세요.
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto etf-return-rank">
      {hideHeader ? null : (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="section-title">ETF 수익률 순위</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {returnPeriodLabel(period)} 전 시장 종가 대비 · 높은 순
            </p>
          </div>
        </div>
      )}
      <table className="etf-return-rank__table">
        <thead>
          <tr>
            <th>#</th>
            <th>ETF</th>
            <th>수익률</th>
            {showSparkline ? <th>추이</th> : null}
            <th>운용사</th>
            <th>AUM</th>
          </tr>
        </thead>
        <tbody>
          {visibleItems.map((etf, index) => {
            const ret = etf.nav_return_pct ?? 0;
            const up = ret >= 0;
            return (
              <tr key={etf.ticker}>
                <td className="etf-return-rank__rank">{rankOffset + index + 1}</td>
                <td className="etf-return-rank__name">
                  <Link href={`/etfs/${etf.ticker}`} className="etf-return-rank__link">
                    {etf.name}
                  </Link>
                  <div className="etf-return-rank__ticker">{etf.ticker}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    <EtfCategoryTag etfName={etf.name} />
                    <span className={`badge ${etf.strategy_type === "active" ? "badge-up" : ""}`}>
                      {strategyLabel(etf.strategy_type)}
                    </span>
                  </div>
                </td>
                <td className="etf-return-rank__return">
                  <span className={`etf-return-rank__pct ${up ? "delta-positive" : "delta-negative"}`}>
                    {formatPercent(ret, 2, true)}
                  </span>
                </td>
                {showSparkline ? (
                  <td className="etf-return-rank__spark">
                    <Link href={`/etfs/${etf.ticker}`}>
                      <EtfNavSparkline
                        data={navByTicker[etf.ticker] ?? []}
                        ticker={etf.ticker}
                        periodDays={periodToDays(period)}
                        width={72}
                        height={28}
                      />
                    </Link>
                  </td>
                ) : null}
                <td className="etf-return-rank__manager">
                  {etf.manager ? formatManagerShort(etf.manager) : "—"}
                </td>
                <td className="etf-return-rank__aum">{formatKrw(etf.latest_aum)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {paginate ? (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          className="mt-3"
        />
      ) : null}
    </div>
  );
}
