import { HomeEtfRankSection } from "@/components/explorer/HomeEtfRankSection";
import { fetchEtfNavSparklines, fetchEtfReturnRankings } from "@/lib/db/queries";
import type { ReturnPeriod } from "@/lib/types";
import { navSparklineDays } from "@/lib/rankings";

type Props = {
  manager?: string;
  period: ReturnPeriod;
};

export async function HomeEtfRankLoader({ manager, period }: Props) {
  const etfRanked = await fetchEtfReturnRankings({ manager, strategy: "active" }, period, 40);
  const etfGainers = etfRanked.slice(0, 10);
  const etfLosers = [...etfRanked]
    .sort((a, b) => (a.nav_return_pct ?? 0) - (b.nav_return_pct ?? 0))
    .slice(0, 10);
  const etfTickers = [...new Set([...etfGainers, ...etfLosers].map((e) => e.ticker))];
  const navByTicker = await fetchEtfNavSparklines(etfTickers, navSparklineDays(period));

  return (
    <HomeEtfRankSection gainers={etfGainers} losers={etfLosers} navByTicker={navByTicker} period={period} />
  );
}

export function HomeEtfRankSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="h-7 w-32 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
          <div className="card h-64 animate-pulse bg-[var(--surface-muted)]" />
        </div>
      ))}
    </div>
  );
}
