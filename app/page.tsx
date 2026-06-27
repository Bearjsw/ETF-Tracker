import Link from "next/link";
import { Suspense } from "react";
import { ActiveMarketOverviewCard } from "@/components/explorer/ActiveMarketOverviewCard";
import { AssetClassFundFlowSection } from "@/components/explorer/AssetClassFundFlowSection";
import { ChangeFeed } from "@/components/explorer/ChangeFeed";
import { HomeEtfRankLoader, HomeEtfRankSkeleton } from "@/components/explorer/HomeEtfRankLoader";
import { HomeStockFlowLoader, HomeStockFlowSkeleton } from "@/components/explorer/HomeStockFlowLoader";
import { ManagerFilter } from "@/components/explorer/ManagerFilter";
import { SignalListTable } from "@/components/explorer/SignalListTable";
import { StatCard } from "@/components/explorer/StatCard";
import { StockFlowSortBar } from "@/components/explorer/StockFlowSortBar";
import { EtfPeriodTabs } from "@/components/explorer/EtfPeriodTabs";
import {
  fetchDashboard,
  fetchActiveMarketOverview,
  fetchAssetClassFundFlows,
  fetchEtfNamesByTickers,
  fetchManagers,
  fetchStockPriceSparklinesByRef,
} from "@/lib/db/queries";
import { parseReturnPeriod, parseStockFlowSort } from "@/lib/rankings";
import { REBALANCE_FLOW_FOOTNOTE } from "@/lib/est-flow";
import { formatKrw, formatStatsPeriod } from "@/lib/utils";

type SearchParams = Promise<{ manager?: string; sort?: string; period?: string }>;

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const manager = params.manager || undefined;
  const sort = parseStockFlowSort(params.sort);
  const period = parseReturnPeriod(params.period);

  const [managers, dashboard, marketOverview, fundFlows] = await Promise.all([
    fetchManagers(),
    fetchDashboard(manager),
    fetchActiveMarketOverview(manager),
    fetchAssetClassFundFlows(manager),
  ]);
  const { stats, topSignals, recentChanges } = dashboard;

  const signalTickers = [...new Set(topSignals.flatMap((s) => s.etf_tickers ?? []))];
  const previewChanges = recentChanges.slice(0, 4);

  const [etfMap, priceByStock] = await Promise.all([
    fetchEtfNamesByTickers(signalTickers),
    fetchStockPriceSparklinesByRef(
      previewChanges.map((c) => ({ stock_code: c.stock_code, stock_name: c.stock_name })),
      90,
      { maxYahooFetches: 8 },
    ),
  ]);

  return (
    <div className="space-y-6">
      <section className="space-y-2.5">
        <p className="text-label">액티브 ETF 비중 추적</p>
        <h1 className="page-hero max-w-xl">
          비중이 바뀐 만큼,
          <br />
          <span className="rounded-md bg-[var(--accent-bright)] px-1.5">수익이 따라왔는지</span> 확인하세요
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-[var(--muted)]">
          시장 규모·자금흐름, 종목 look-through 비중 변화, 시그널을 각각 나눠 추적합니다.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href="/market" className="btn-primary">
            시장
          </Link>
          <Link href="/flows" className="btn-ghost">
            흐름
          </Link>
          <Link href="/signals" className="btn-ghost">
            시그널
          </Link>
        </div>
      </section>

      <ManagerFilter managers={managers} current={manager} />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="최근 변화" value={`${stats.changeCount}건`} sub={formatStatsPeriod(stats)} />
        <StatCard
          label="순매수 추정"
          value={formatKrw(stats.accumulationFlow)}
          sub={`최근 ${stats.windowDays ?? 3}일 · ${REBALANCE_FLOW_FOOTNOTE}`}
          trend="positive"
        />
        <StatCard
          label="순매도 추정"
          value={formatKrw(stats.distributionFlow)}
          sub={`최근 ${stats.windowDays ?? 3}일 · ${REBALANCE_FLOW_FOOTNOTE}`}
          trend="negative"
        />
        <StatCard
          label="활성 시그널"
          value={`${stats.signalCount}건`}
          sub={`추적 중 ${stats.activeEtfCount}개 ETF`}
        />
      </section>

      <ActiveMarketOverviewCard overview={marketOverview} manager={manager} />

      <AssetClassFundFlowSection report={fundFlows} manager={manager} compact />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="section-title">종목 흐름</h2>
          <Link href="/flows" className="text-sm font-semibold text-[var(--accent)] hover:underline">
            전체 보기
          </Link>
        </div>
        <Suspense fallback={null}>
          <StockFlowSortBar current={{ sort, period, manager }} basePath="/flows" />
        </Suspense>
        <Suspense fallback={<HomeStockFlowSkeleton />}>
          <HomeStockFlowLoader manager={manager} sort={sort} period={period} limit={5} />
        </Suspense>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="section-title">비중 변화</h2>
          <Link href="/flows" className="text-sm font-semibold text-[var(--accent)] hover:underline">
            전체 보기
          </Link>
        </div>
        <ChangeFeed
          changes={previewChanges}
          title=""
          layout="grid"
          priceByStock={priceByStock}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="section-title">시그널</h2>
          <Link href="/signals" className="text-sm font-semibold text-[var(--accent)] hover:underline">
            전체 보기
          </Link>
        </div>
        {topSignals.length ? (
          <SignalListTable signals={topSignals.slice(0, 4)} etfMap={etfMap} />
        ) : (
          <div className="card text-sm text-[var(--muted)]">아직 시그널이 없습니다.</div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="section-title">ETF 수익률</h2>
          <Link href="/etfs?strategy=active" className="text-sm font-semibold text-[var(--accent)] hover:underline">
            전체 ETF
          </Link>
        </div>
        <Suspense fallback={null}>
          <EtfPeriodTabs current={{ period }} basePath="/" />
        </Suspense>
        <Suspense fallback={<HomeEtfRankSkeleton />}>
          <HomeEtfRankLoader manager={manager} period={period} />
        </Suspense>
      </section>
    </div>
  );
}
