import Link from "next/link";
import { notFound } from "next/navigation";
import { HoldingsDiffTimeline } from "@/components/explorer/HoldingsDiffTimeline";
import { HoldingsTable } from "@/components/explorer/HoldingsTable";
import { fetchEtfDetail } from "@/lib/db/queries";
import { formatKrw, strategyLabel } from "@/lib/utils";

type Params = Promise<{ ticker: string }>;

export default async function EtfDetailPage({ params }: { params: Params }) {
  const { ticker } = await params;
  const { etf, holdings, diffs, meta } = await fetchEtfDetail(ticker);
  if (!etf) notFound();

  const latestDate = holdings[0]?.date;

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              {etf.name} <span className="text-[var(--muted)]">({etf.ticker})</span>
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {etf.manager ? (
                <Link href={`/managers/${encodeURIComponent(etf.manager)}`} className="text-[var(--accent)]">
                  {etf.manager}
                </Link>
              ) : (
                "운용사 미상"
              )}{" "}
              · {strategyLabel(etf.strategy_type)} · {etf.market ?? "시장 미상"}
            </p>
          </div>
          <div className="text-right text-sm">
            <div>AUM {formatKrw(meta?.aum)}</div>
            <div className="text-[var(--muted)]">NAV {meta?.nav ?? "-"}</div>
          </div>
        </div>
      </div>
      <HoldingsTable holdings={holdings} latestDate={latestDate} />
      <HoldingsDiffTimeline diffs={diffs} />
    </div>
  );
}
