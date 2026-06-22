"use client";

import Link from "next/link";
import { useState } from "react";
import { EtfNavSparkline } from "@/components/explorer/EtfNavSparkline";
import { WeightBar } from "@/components/explorer/WeightBar";
import { Pagination } from "@/components/ui/Pagination";
import type { EtfNavPoint, EtfUniverse, HoldingDaily } from "@/lib/types";
import { strategyLabel } from "@/lib/utils";

const PAGE_SIZE = 5;

type Props = {
  rows: HoldingDaily[];
  etfs: EtfUniverse[];
  navByTicker: Record<string, EtfNavPoint[]>;
  maxWeight: number;
};

export function StockHoldingsTable({ rows, etfs, navByTicker, maxWeight }: Props) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="card overflow-x-auto">
      <h2 className="section-title mb-4">보유 ETF (비중 순)</h2>
      {rows.length ? (
        <>
          <table>
            <thead>
              <tr>
                <th>ETF</th>
                <th>3달 NAV</th>
                <th>유형</th>
                <th>비중</th>
                <th>기준일</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const etf = etfs.find((e) => e.ticker === row.etf_ticker);
                return (
                  <tr key={row.etf_ticker}>
                    <td>
                      <Link href={`/etfs/${row.etf_ticker}`} className="font-medium hover:text-[var(--accent)]">
                        {etf?.name ?? row.etf_ticker}
                      </Link>
                      <div className="text-xs text-[var(--muted)]">{row.etf_ticker}</div>
                    </td>
                    <td>
                      <Link href={`/etfs/${row.etf_ticker}`}>
                        <EtfNavSparkline data={navByTicker[row.etf_ticker] ?? []} ticker={row.etf_ticker} showPerf />
                      </Link>
                    </td>
                    <td>
                      <span className="text-sm text-[var(--muted)]">{etf ? strategyLabel(etf.strategy_type) : "—"}</span>
                    </td>
                    <td>
                      <WeightBar weight={row.weight} maxWeight={maxWeight} variant="positive" />
                    </td>
                    <td className="text-sm text-[var(--muted)]">{row.date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {totalPages > 1 ? (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
          ) : null}
        </>
      ) : (
        <p className="text-sm text-[var(--muted)]">보유 데이터가 없습니다.</p>
      )}
    </div>
  );
}
