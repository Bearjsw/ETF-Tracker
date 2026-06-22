"use client";

import { useState } from "react";
import Link from "next/link";
import { RankDirectionTabs } from "@/components/explorer/RankDirectionTabs";
import { StockLogo } from "@/components/explorer/Logo";
import { StockLabel } from "@/components/explorer/StockLabel";
import { StockPriceSparkline } from "@/components/explorer/StockPriceSparkline";
import type { OverseasStockRankItem, ReturnPeriod, StockPricePoint } from "@/lib/types";
import { returnPeriodLabel } from "@/lib/rankings";
import { formatPercent } from "@/lib/utils";

type Props = {
  gainers: OverseasStockRankItem[];
  losers: OverseasStockRankItem[];
  priceByStock: Record<string, StockPricePoint[]>;
  period: ReturnPeriod;
};

export function OverseasStockChartGrid({ gainers, losers, priceByStock, period }: Props) {
  const [direction, setDirection] = useState<"up" | "down">("up");
  const items = direction === "up" ? gainers : losers;

  if (!gainers.length && !losers.length) {
    return (
      <div className="card">
        <h2 className="section-title mb-2">해외 종목 주가 추이</h2>
        <p className="text-sm text-[var(--muted)]">
          해외 보유 종목 주가 이력이 없습니다.{" "}
          <code className="code-inline">python scripts/collect_stock_prices.py --all-listed</code> 실행 후
          다시 확인해 보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="section-title">해외 종목 주가 추이</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            ETF 보유 해외주 · {returnPeriodLabel(period)} 전 대비
          </p>
        </div>
        <RankDirectionTabs value={direction} onChange={setDirection} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((stock, index) => {
          const ret = stock.price_return_pct ?? 0;
          const up = ret >= 0;
          return (
            <Link
              key={stock.stock_code}
              href={`/stocks/${stock.stock_code}`}
              className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[#fafbf9] p-3 transition-colors hover:border-[#c5d4c0]"
            >
              <span className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-[var(--muted)]">
                {index + 1}
              </span>
              <StockLogo stockName={stock.stock_name} stockCode={stock.stock_code} size={40} variant="circle" />
              <div className="min-w-0 flex-1">
                <StockLabel stockName={stock.stock_name} stockCode={stock.stock_code} className="truncate text-sm font-semibold" />
                <p className="text-xs text-[var(--muted)] tabular-nums">{stock.stock_code}</p>
              </div>
              <div className="shrink-0 text-right">
                <StockPriceSparkline
                  data={priceByStock[stock.stock_code] ?? []}
                  stockCode={stock.stock_code}
                  width={96}
                  height={36}
                  showPerf
                />
                <p
                  className={`mt-1 text-xs font-semibold tabular-nums ${up ? "delta-positive" : "delta-negative"}`}
                >
                  {stock.price_return_pct != null ? formatPercent(stock.price_return_pct, 2, true) : "—"}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
