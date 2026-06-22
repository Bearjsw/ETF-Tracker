import Link from "next/link";
import { Suspense } from "react";
import { ActiveMarketOverviewCard } from "@/components/explorer/ActiveMarketOverviewCard";
import { AssetClassFundFlowSection } from "@/components/explorer/AssetClassFundFlowSection";
import { ManagerFilter } from "@/components/explorer/ManagerFilter";
import { NewListingsFilter } from "@/components/explorer/NewListingsFilter";
import { NewListingsSection } from "@/components/explorer/NewListingsSection";
import { PageHeader } from "@/components/explorer/PageHeader";
import {
  fetchActiveMarketOverview,
  fetchAssetClassFundFlows,
  fetchManagers,
  fetchNewListings,
} from "@/lib/db/queries";
import { parseListingCategoryFilter } from "@/lib/etf-asset-class";

type SearchParams = Promise<{ manager?: string; category?: string }>;

export default async function MarketPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const manager = params.manager || undefined;
  const category = parseListingCategoryFilter(params.category);

  const [managers, overview, fundFlows, newListings] = await Promise.all([
    fetchManagers(),
    fetchActiveMarketOverview(manager),
    fetchAssetClassFundFlows(manager),
    fetchNewListings(90),
  ]);

  const items =
    category === "all"
      ? newListings.items
      : newListings.items.filter((item) => item.asset_class === category);

  return (
    <div className="space-y-8">
      <PageHeader
        title="시장"
        description="액티브·테마 ETF 시장 규모, 설정·환매 자금흐름(Δ좌수×NAV), 신규상장을 한곳에서 봅니다."
      />

      <ManagerFilter managers={managers} current={manager} />

      <ActiveMarketOverviewCard overview={overview} manager={manager} />

      <AssetClassFundFlowSection report={fundFlows} manager={manager} />

      <section id="listings" className="scroll-mt-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="section-title">신규상장</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              최근 {newListings.days}일 내 상장 · 자산군별 필터
            </p>
          </div>
          <Link href="/etfs?strategy=active" className="text-sm font-semibold text-[var(--accent)] hover:underline">
            전체 ETF
          </Link>
        </div>

        <Suspense fallback={null}>
          <NewListingsFilter current={{ category: params.category }} />
        </Suspense>

        <NewListingsSection items={items} days={newListings.days} />
      </section>
    </div>
  );
}
