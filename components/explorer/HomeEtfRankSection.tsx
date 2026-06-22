"use client";

import { useState } from "react";
import { EtfReturnRankList } from "@/components/explorer/EtfReturnRankList";
import { RankDirectionTabs } from "@/components/explorer/RankDirectionTabs";
import type { EtfNavPoint, EtfReturnRankItem, ReturnPeriod } from "@/lib/types";

type Props = {
  gainers: EtfReturnRankItem[];
  losers: EtfReturnRankItem[];
  navByTicker: Record<string, EtfNavPoint[]>;
  period: ReturnPeriod;
};

export function HomeEtfRankSection({ gainers, losers, navByTicker, period }: Props) {
  const [direction, setDirection] = useState<"up" | "down">("up");
  const items = direction === "up" ? gainers : losers;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="section-title">ETF 수익률 순위</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">액티브·테마 ETF · NAV 기준</p>
        </div>
        <RankDirectionTabs value={direction} onChange={setDirection} />
      </div>
      <EtfReturnRankList items={items} navByTicker={navByTicker} period={period} hideHeader />
    </section>
  );
}
