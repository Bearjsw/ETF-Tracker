import Link from "next/link";
import type { ActiveMarketOverview } from "@/lib/types";
import { formatKrw, formatPercent } from "@/lib/utils";
import { EtfCategoryTag } from "@/components/explorer/EtfCategoryTag";

type Props = {
  overview: ActiveMarketOverview;
  manager?: string;
};

export function ActiveMarketOverviewCard({ overview, manager }: Props) {
  if (!overview.etfCount) {
    return (
      <section className="card text-sm text-[var(--muted)]">
        액티브·테마 ETF 시장 구성 데이터가 없습니다.
      </section>
    );
  }

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="section-title">액티브 ETF 시장 구성</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            추적 중 {overview.etfCount}개 · 설정액 합계 {formatKrw(overview.totalAum)}
            {overview.asOfDate ? ` · 기준 ${overview.asOfDate}` : null}
            {manager ? ` · ${manager}` : null}
          </p>
        </div>
        <Link href="/market#listings" className="text-sm font-semibold text-[var(--accent)] hover:underline">
          신규상장 보기
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {overview.slices.map((slice) => (
          <span key={slice.assetClass} className="market-slice-pill">
            <EtfCategoryTag assetClass={slice.assetClass} />
            <span className="market-slice-pill__pct">{formatPercent(slice.sharePct, 1)}</span>
            <span className="market-slice-pill__meta text-[var(--muted)]">
              {slice.count}종 · {formatKrw(slice.aum)}
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}
