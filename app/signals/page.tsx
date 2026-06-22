import Link from "next/link";
import { Suspense } from "react";
import { SignalFeedDashboard } from "@/components/explorer/SignalFeedDashboard";
import { SignalFilters } from "@/components/explorer/SignalFilters";
import { SignalListSection } from "@/components/explorer/SignalListSection";
import {
  fetchDashboard,
  fetchEtfNamesByTickers,
  fetchManagers,
  fetchSignalsFiltered,
} from "@/lib/db/queries";
import {
  matchesStockFilters,
  normalizeCategoryForMarket,
  parseStockCategory,
  parseStockMarket,
} from "@/lib/stock-filters";
import { formatStatsPeriod } from "@/lib/utils";

type SearchParams = Promise<{
  manager?: string;
  direction?: string;
  window?: string;
  q?: string;
  market?: string;
  category?: string;
}>;

export default async function SignalsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const windowDays = params.window ? Number(params.window) : undefined;
  const market = parseStockMarket(params.market);
  const category = normalizeCategoryForMarket(market, parseStockCategory(params.category));

  const [managers, dashboard] = await Promise.all([fetchManagers(), fetchDashboard()]);
  const allSignals = await fetchSignalsFiltered({
    manager: params.manager,
    direction: params.direction,
    windowDays,
    query: params.q,
    limit: 200,
  });

  const signals = allSignals.filter((s) =>
    matchesStockFilters(s.stock_name, s.stock_code, market, category),
  );

  const allTickers = [...new Set(signals.flatMap((s) => s.etf_tickers ?? []))];
  const etfMap = await fetchEtfNamesByTickers(allTickers);

  const accumulation = signals.filter((s) => s.direction === "accumulation").length;
  const distribution = signals.filter((s) => s.direction === "distribution").length;
  const consensus = signals.filter((s) => s.signal_type === "consensus").length;
  const uniqueManagers = new Set(
    signals.flatMap((s) => s.etf_tickers.map((t) => etfMap[t]?.manager).filter(Boolean)),
  ).size;

  const sectionTitle =
    category === "equity"
      ? "주식 시그널"
      : category === "bond"
        ? "채권 시그널"
        : market === "domestic"
          ? "국내 시그널"
          : market === "overseas"
            ? "해외 시그널"
            : "비중 확대 합의";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-display text-3xl">시그널 피드</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          여러 운용사의 액티브 ETF가 같은 방향으로 움직인 종목을 모아 보여줍니다.
        </p>
      </div>

      <SignalFeedDashboard
        signalCount={signals.length}
        accumulation={accumulation}
        distribution={distribution}
        consensus={consensus}
        activeEtfCount={dashboard.stats.activeEtfCount}
        managerCount={uniqueManagers || managers.length}
        dataPeriod={formatStatsPeriod(dashboard.stats).replace(/^최근 \d+일 · /, "")}
      />

      <Suspense fallback={<div className="signal-filter-bar h-12 animate-pulse bg-white/60" />}>
        <SignalFilters
          managers={managers}
          signals={allSignals}
          current={{
            manager: params.manager,
            direction: params.direction,
            window: params.window,
            q: params.q,
            market: params.market,
            category: params.category,
          }}
        />
      </Suspense>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">
            {sectionTitle} ({signals.length}종목)
          </h2>
          <Link href="/" className="text-sm font-semibold text-[var(--accent)] hover:underline">
            홈으로
          </Link>
        </div>
        <SignalListSection signals={signals} etfMap={etfMap} />
      </div>
    </div>
  );
}
