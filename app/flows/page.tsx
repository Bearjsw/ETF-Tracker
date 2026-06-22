import { Suspense } from "react";
import {
  FlowsChangesLoader,
  FlowsChangesSkeleton,
} from "@/components/explorer/FlowsChangesLoader";
import {
  FlowsRebalanceLoader,
  FlowsRebalanceSkeleton,
} from "@/components/explorer/FlowsRebalanceLoader";
import {
  FlowsStockSectionLoader,
  FlowsStockSectionSkeleton,
} from "@/components/explorer/FlowsStockSectionLoader";
import { PageHeader } from "@/components/explorer/PageHeader";
import { ManagerFilter } from "@/components/explorer/ManagerFilter";
import { fetchManagers } from "@/lib/db/queries";
import { parseReturnPeriod, parseStockFlowSort } from "@/lib/rankings";
import {
  normalizeCategoryForMarket,
  parseStockCategory,
  parseStockMarket,
} from "@/lib/stock-filters";

type SearchParams = Promise<{
  manager?: string;
  sort?: string;
  period?: string;
  market?: string;
  category?: string;
  q?: string;
}>;

export default async function FlowsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const manager = params.manager || undefined;
  const sort = parseStockFlowSort(params.sort);
  const period = parseReturnPeriod(params.period);
  const market = parseStockMarket(params.market);
  const category = normalizeCategoryForMarket(market, parseStockCategory(params.category));

  const managers = await fetchManagers();

  return (
    <div className="space-y-6">
      <PageHeader
        title="흐름"
        description="종목 look-through 비중 변화와 ETF·운용사 리밸런싱 추정입니다. 설정·환매(Δ좌수×NAV)는 시장 페이지를 참고하세요."
      />

      <ManagerFilter managers={managers} current={manager} />

      <Suspense fallback={<FlowsRebalanceSkeleton />}>
        <FlowsRebalanceLoader manager={manager} />
      </Suspense>

      <Suspense fallback={<FlowsStockSectionSkeleton />}>
        <FlowsStockSectionLoader
          manager={manager}
          sort={sort}
          period={period}
          market={market}
          category={category}
          params={params}
        />
      </Suspense>

      <Suspense fallback={<FlowsChangesSkeleton />}>
        <FlowsChangesLoader manager={manager} />
      </Suspense>
    </div>
  );
}
