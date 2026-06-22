import Link from "next/link";
import { StockLogo } from "@/components/explorer/Logo";
import { AssetClassTag } from "@/components/explorer/AssetClassTag";
import { StockHoldingsTable } from "@/components/explorer/StockHoldingsTable";
import { SignalHistoryList } from "@/components/explorer/SignalHistoryList";
import { StockDualChart } from "@/components/explorer/StockDualChart";
import { isBondLikeAsset } from "@/lib/bond-issuer";
import {
  fetchEtfNavSparklines,
  fetchStockHoldings,
  fetchStockEtfWeightSeries,
  fetchStockPriceHistory,
} from "@/lib/db/queries";
import { formatStockDisplayName, getStockDisplayTooltip } from "@/lib/stock-display";
import { formatKrw, formatPercent } from "@/lib/utils";
import type { HoldingDiffEnriched, WeightChartMarker } from "@/lib/types";

type Params = Promise<{ code: string }>;

export default async function StockPage({ params }: { params: Params }) {
  const { code } = await params;
  const { holdings, etfs, diffs } = await fetchStockHoldings(code);
  const stockNamePreview = holdings[0]?.stock_name ?? code;
  const showPriceChart = !isBondLikeAsset(stockNamePreview, code);
  const [navByTicker, priceHistory, weightSeries] = await Promise.all([
    fetchEtfNavSparklines(etfs.map((e) => e.ticker)),
    showPriceChart ? fetchStockPriceHistory(code, "1m", stockNamePreview) : Promise.resolve([]),
    fetchStockEtfWeightSeries(code),
  ]);

  const latestByEtf = new Map<string, (typeof holdings)[number]>();
  for (const row of holdings) {
    const existing = latestByEtf.get(row.etf_ticker);
    if (!existing || row.date > existing.date) latestByEtf.set(row.etf_ticker, row);
  }

  const rows = [...latestByEtf.values()].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  const stockName = rows[0]?.stock_name ?? holdings[0]?.stock_name ?? code;
  const stockDisplayName = formatStockDisplayName(stockName, code);
  const stockNameDetail = getStockDisplayTooltip(stockName, code);
  const maxWeight = rows[0]?.weight ?? 15;
  const latestWeightDate = holdings[0]?.date ?? null;

  const enrichedDiffs: HoldingDiffEnriched[] = diffs.map((d) => {
    const etf = etfs.find((e) => e.ticker === d.etf_ticker);
    return {
      ...d,
      etf_name: etf?.name ?? null,
      manager: etf?.manager ?? null,
      return_since_change: (d as { return_since_change?: number }).return_since_change ?? null,
    };
  });

  const markers: WeightChartMarker[] = enrichedDiffs.map((d) => ({
    date: d.date,
    etfTicker: d.etf_ticker,
    changeType: d.change_type,
  }));

  const latestPerf = enrichedDiffs.find((d) => d.return_since_change != null)?.return_since_change;
  const netFlow = diffs.reduce((s, d) => s + (d.est_flow_krw ?? 0), 0);

  return (
    <div className="space-y-6">
      <nav className="breadcrumb">
        <Link href="/signals">피드</Link>
        <span>/</span>
        <span className="font-semibold text-[var(--foreground)]">
          {stockDisplayName} {code}
        </span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <StockLogo stockName={stockName} stockCode={code} size={52} variant="circle" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-display text-3xl">{stockDisplayName}</h1>
              <AssetClassTag stockName={stockName} stockCode={code} className="mt-1" />
            </div>
            {stockNameDetail ? (
              <p className="mt-1 max-w-xl text-sm text-[var(--muted)]" title={stockNameDetail}>
                {stockNameDetail}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-[var(--muted)]">{code}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-6 text-right">
          <div>
            <p className="text-label">보유 ETF</p>
            <p className="text-stat mt-1 text-base">{rows.length}개</p>
          </div>
          <div>
            <p className="text-label">순 자금 흐름</p>
            <p className={`text-stat mt-1 text-base ${netFlow >= 0 ? "delta-positive" : "delta-negative"}`}>
              {netFlow >= 0 ? "+" : "−"}
              {formatKrw(Math.abs(netFlow))}
            </p>
          </div>
          <div>
            <p className="text-label">변화 후 수익</p>
            <p
              className={`text-stat mt-1 text-base ${
                latestPerf == null ? "text-[var(--muted)]" : latestPerf >= 0 ? "delta-positive" : "delta-negative"
              }`}
            >
              {latestPerf != null ? formatPercent(latestPerf, 2, true) : "—"}
            </p>
          </div>
        </div>
      </div>

      <StockDualChart
        stockCode={code}
        stockName={stockName}
        priceData={priceHistory}
        weightSeries={weightSeries}
        markers={markers}
        latestWeightDate={latestWeightDate}
        showPriceChart={showPriceChart}
      />

      <SignalHistoryList diffs={enrichedDiffs} />

      <StockHoldingsTable rows={rows} etfs={etfs} navByTicker={navByTicker} maxWeight={maxWeight} />
    </div>
  );
}
