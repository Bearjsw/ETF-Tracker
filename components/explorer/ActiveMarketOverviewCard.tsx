import Link from "next/link";
import type { ActiveMarketOverview } from "@/lib/types";
import { formatKrw, formatPercent } from "@/lib/utils";
import { EtfCategoryTag } from "@/components/explorer/EtfCategoryTag";

type Props = {
  overview: ActiveMarketOverview;
  manager?: string;
  /** 기본 `/market#listings` — 시장 페이지에서는 `#listings` 전달 */
  listingsHref?: string;
};

export function ActiveMarketOverviewCard({
  overview,
  manager,
  listingsHref = "/market#listings",
}: Props) {
  if (!overview.etfCount) {
    return (
      <section className="card text-sm text-[var(--muted)]">
        액티브·테마 ETF 시장 구성 데이터가 없습니다.
      </section>
    );
  }

  return (
    <section className="card space-y-4">
      <div className="market-overview-head">
        <h2 className="section-title shrink-0">액티브 ETF 시장 구성</h2>
        <div className="market-overview-head__end">
          <p className="market-overview-head__meta text-xs text-[var(--muted)]">
            추적 중 {overview.etfCount}개 · 설정액 합계 {formatKrw(overview.totalAum)}
            {overview.asOfDate ? ` · 기준 ${overview.asOfDate}` : null}
            {manager ? ` · ${manager}` : null}
          </p>
          <Link
            href={listingsHref}
            className="market-overview-head__link shrink-0 text-xs font-semibold text-[var(--accent)] hover:underline"
          >
            신규상장
          </Link>
        </div>
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
