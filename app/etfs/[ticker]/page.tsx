import Link from "next/link";
import { notFound } from "next/navigation";
import { ChangeFeed } from "@/components/explorer/ChangeFeed";
import { EtfHoldingsTreemapLoader } from "@/components/explorer/EtfHoldingsTreemapLoader";
import { EtfPriceChart } from "@/components/explorer/EtfPriceChart";
import { HoldingsDiffTimeline } from "@/components/explorer/HoldingsDiffTimeline";
import { EtfCategoryTag } from "@/components/explorer/EtfCategoryTag";
import { fetchEtfDetail, fetchEtfNavHistory, fetchStockPriceSparklinesByRef } from "@/lib/db/queries";
import {
  enrichChangesWithFlowEstimates,
  filterDiffsByWindow,
  REBALANCE_FLOW_FOOTNOTE,
  REBALANCE_FLOW_WINDOW_DAYS,
  summarizeFlowTotals,
} from "@/lib/est-flow";
import { formatManagerDisplay, managerKey } from "@/lib/managers";
import { formatKrw, isAccumulation, strategyLabel } from "@/lib/utils";
import { getLatestHoldingsDate } from "@/lib/holdings";

type Params = Promise<{ ticker: string }>;

export default async function EtfDetailPage({ params }: { params: Params }) {
  const { ticker } = await params;
  const [{ etf, holdings, diffs, meta }, navHistory] = await Promise.all([
    fetchEtfDetail(ticker),
    fetchEtfNavHistory(ticker, "all"),
  ]);
  if (!etf) notFound();

  let priceByStock: Awaited<ReturnType<typeof fetchStockPriceSparklinesByRef>> = {};
  try {
    priceByStock = await fetchStockPriceSparklinesByRef(
      diffs.map((d) => ({ stock_code: d.stock_code, stock_name: d.stock_name })),
      120,
      { maxYahooFetches: 15 },
    );
  } catch (err) {
    console.error("[EtfDetailPage] price sparklines", err);
  }

  const holdingsDate = getLatestHoldingsDate(holdings);

  const enrichedDiffs = (() => {
    const aumByTicker = new Map<string, number>();
    if (meta?.aum != null && meta.aum > 0) aumByTicker.set(etf.ticker, meta.aum);
    return enrichChangesWithFlowEstimates(
      diffs.map((d) => ({
        ...d,
        etf_name: etf.name,
        manager: etf.manager,
        strategy_type: etf.strategy_type,
        return_since_change: (d as { return_since_change?: number }).return_since_change ?? null,
      })),
      aumByTicker,
      meta?.aum ?? 50_000_000_000,
    );
  })();

  const windowDiffs = filterDiffsByWindow(enrichedDiffs, REBALANCE_FLOW_WINDOW_DAYS);
  const { inflow: totalInflow, outflow: totalOutflow } = summarizeFlowTotals(windowDiffs, meta?.aum);
  const diffStats = enrichedDiffs.reduce(
    (acc, diff) => {
      if (isAccumulation(diff.change_type, diff.weight_delta)) acc.up += 1;
      else acc.down += 1;
      return acc;
    },
    { up: 0, down: 0 },
  );

  return (
    <div className="space-y-6">
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
            <h1 className="page-title mt-2">{etf.name}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {etf.manager ? (
                <Link
                  href={`/managers/${encodeURIComponent(managerKey(etf.manager) || etf.manager)}`}
                  className="hover:text-[var(--accent)]"
                >
                  {formatManagerDisplay(etf.manager)}
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
              <p className="text-stat mt-1 text-base text-[var(--accent)]">{diffs.length.toLocaleString("ko-KR")}건</p>
            </div>
          </div>
        </div>
        {windowDiffs.length > 0 && (totalInflow > 0 || totalOutflow > 0) ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--border-subtle)] pt-4 text-sm">
            {totalInflow > 0 ? (
              <span className="delta-positive">순매수 추정 {formatKrw(totalInflow)}</span>
            ) : null}
            {totalOutflow > 0 ? (
              <span className="delta-negative">순매도 추정 {formatKrw(totalOutflow)}</span>
            ) : null}
            <span className="text-xs text-[var(--muted)]">
              최근 {REBALANCE_FLOW_WINDOW_DAYS}일 · {REBALANCE_FLOW_FOOTNOTE}
            </span>
          </div>
        ) : null}
      </section>

      <EtfHoldingsTreemapLoader
        holdings={holdings}
        etfName={etf.name}
        holdingsDate={holdingsDate}
      />

      {enrichedDiffs.length > 0 ? (
        <ChangeFeed
          changes={enrichedDiffs.slice(0, 5)}
          priceByStock={priceByStock}
          title="구성종목 비중 변동"
          titleStats={diffStats}
          compact
          hideSourceTag
          showSparkline={false}
          logoSize={48}
          unifiedCard
        />
      ) : null}

      <HoldingsDiffTimeline diffs={enrichedDiffs} title="전체 변화 이력" showEtf={false} />

      <EtfPriceChart ticker={ticker} data={navHistory} />
    </div>
  );
}
