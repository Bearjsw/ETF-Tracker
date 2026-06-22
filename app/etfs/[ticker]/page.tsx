import Link from "next/link";
import { notFound } from "next/navigation";
import { ChangeFeed } from "@/components/explorer/ChangeFeed";
import { EtfHoldingsPieChart } from "@/components/explorer/EtfHoldingsPieChart";
import { EtfPriceChart } from "@/components/explorer/EtfPriceChart";
import { HoldingsDiffTimeline } from "@/components/explorer/HoldingsDiffTimeline";
import { TopHoldingsCard } from "@/components/explorer/TopHoldingsCard";
import { EtfCategoryTag } from "@/components/explorer/EtfCategoryTag";
import { fetchEtfDetail, fetchEtfNavHistory, fetchStockPriceSparklinesByRef } from "@/lib/db/queries";
import { formatKrw, strategyLabel } from "@/lib/utils";

type Params = Promise<{ ticker: string }>;

export default async function EtfDetailPage({ params }: { params: Params }) {
  const { ticker } = await params;
  const [{ etf, holdings, diffs, meta }, navHistory] = await Promise.all([
    fetchEtfDetail(ticker),
    fetchEtfNavHistory(ticker, "all"),
  ]);
  if (!etf) notFound();

  const priceByStock = await fetchStockPriceSparklinesByRef(
    diffs.map((d) => ({ stock_code: d.stock_code, stock_name: d.stock_name })),
    120,
    { maxYahooFetches: 15 },
  );

  const enrichedDiffs = diffs.map((d) => ({
    ...d,
    etf_name: etf.name,
    manager: etf.manager,
    strategy_type: etf.strategy_type,
    return_since_change: (d as { return_since_change?: number }).return_since_change ?? null,
  }));

  const totalInflow = diffs
    .filter((d) => (d.est_flow_krw ?? 0) > 0)
    .reduce((s, d) => s + (d.est_flow_krw ?? 0), 0);
  const totalOutflow = diffs
    .filter((d) => (d.est_flow_krw ?? 0) < 0)
    .reduce((s, d) => s + Math.abs(d.est_flow_krw ?? 0), 0);

  return (
    <div className="space-y-8">
      <section className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <EtfCategoryTag etfName={etf.name} />
              <span className={`badge ${etf.strategy_type === "active" ? "badge-up" : ""}`}>
                {strategyLabel(etf.strategy_type)}
              </span>
              <span className="text-xs text-[var(--muted)]">{etf.market ?? "—"}</span>
            </div>
            <h1 className="text-display mt-2">{etf.name}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {etf.manager ? (
                <Link href={`/managers/${encodeURIComponent(etf.manager)}`} className="hover:text-[var(--accent)]">
                  {etf.manager}
                </Link>
              ) : (
                "운용사 미상"
              )}{" "}
              · {etf.ticker}
            </p>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-label">AUM</p>
              <p className="text-stat mt-1 text-base">{formatKrw(meta?.aum)}</p>
            </div>
            <div>
              <p className="text-label">비중 변화</p>
              <p className="text-stat mt-1 text-base text-[var(--accent)]">{diffs.length}건</p>
            </div>
          </div>
        </div>
        {diffs.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-4 pt-4 text-sm">
            <span className="delta-positive">순매수 추정 {formatKrw(totalInflow)}</span>
            <span className="delta-negative">순매도 추정 {formatKrw(totalOutflow)}</span>
          </div>
        ) : null}
      </section>

      <EtfPriceChart ticker={ticker} etfName={etf.name} data={navHistory} />

      {enrichedDiffs.length > 0 ? (
        <ChangeFeed
          changes={enrichedDiffs.slice(0, 5)}
          priceByStock={priceByStock}
          title="최근 비중 변화"
          compact
          hideSourceTag
          showSparkline={false}
          logoSize={48}
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <EtfHoldingsPieChart holdings={holdings} etfName={etf.name} />
        <TopHoldingsCard holdings={holdings} etfName={etf.name} />
      </div>
      <HoldingsDiffTimeline diffs={enrichedDiffs} title="전체 변화 이력" showEtf={false} />
    </div>
  );
}
