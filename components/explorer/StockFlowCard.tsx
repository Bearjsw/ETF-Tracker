import Link from "next/link";
import { StockLogo } from "@/components/explorer/Logo";
import { StockLabel } from "@/components/explorer/StockLabel";
import { formatStockDisplayName } from "@/lib/stock-display";
import { AssetClassTag } from "@/components/explorer/AssetClassTag";
import { ManagerTagList } from "@/components/explorer/ManagerTagList";
import { StockPriceSparkline } from "@/components/explorer/StockPriceSparkline";
import type { StockFlowSort, StockFlowSummary, StockPricePoint } from "@/lib/types";
import type { ReturnPeriod } from "@/lib/types";
import { canShowStockPriceChart } from "@/lib/bond-issuer";
import { isIntradayPeriod, periodToDays } from "@/lib/rankings";
import { stockRefKey } from "@/lib/stock-ref";
import { formatKrw, formatPercent } from "@/lib/utils";

export function highlightMetric(flow: StockFlowSummary, sort: StockFlowSort) {
  const showPriceChart = canShowStockPriceChart(flow.stock_name, flow.stock_code);

  switch (sort) {
    case "turnover":
      return { label: "거래대금", value: formatKrw(flow.gross_flow_krw), positive: true };
    case "net_buy":
      return { label: "순매수", value: formatKrw(flow.buy_flow_krw), positive: true };
    case "net_sell":
      return { label: "순매도", value: formatKrw(flow.sell_flow_krw), positive: false };
    case "surge":
    case "drop":
      if (!showPriceChart || flow.price_return_pct == null) {
        return {
          label: "순 흐름",
          value: `${flow.net_flow_krw >= 0 ? "+" : "−"}${formatKrw(Math.abs(flow.net_flow_krw))}`,
          positive: flow.net_flow_krw >= 0,
        };
      }
      return {
        label: "주가 수익",
        value: formatPercent(flow.price_return_pct, 2, true),
        positive: flow.price_return_pct >= 0,
      };
    default:
      return {
        label: "순 흐름",
        value: `${flow.net_flow_krw >= 0 ? "+" : "−"}${formatKrw(Math.abs(flow.net_flow_krw))}`,
        positive: flow.net_flow_krw >= 0,
      };
  }
}

function showSecondaryNetFlow(sort: StockFlowSort) {
  return sort !== "turnover" && sort !== "net_buy" && sort !== "net_sell" && sort !== "surge" && sort !== "drop";
}

type Props = {
  flow: StockFlowSummary;
  index: number;
  sort: StockFlowSort;
  period: ReturnPeriod;
  priceByStock: Record<string, StockPricePoint[]>;
  variant?: "list" | "grid";
};

function flowPriceKey(flow: StockFlowSummary) {
  return stockRefKey({ stock_code: flow.stock_code, stock_name: flow.stock_name ?? null });
}

export function StockFlowCard({
  flow,
  index,
  sort,
  period,
  priceByStock,
  variant = "list",
}: Props) {
  const stockHref = `/stocks/${flow.stock_code}`;
  const priceKey = flowPriceKey(flow);
  const priceData = priceByStock[priceKey] ?? priceByStock[flow.stock_code] ?? [];
  const metric = highlightMetric(flow, sort);
  const isPositive = flow.net_flow_krw >= 0;
  const showPriceChart = canShowStockPriceChart(flow.stock_name, flow.stock_code);
  // 1일·1주: 장중 데이터는 스파크라인이 자체 처리하고, 일별 폴백은 쿼리에서 이미
  // 짧은 창으로 잘려 오므로 추가 트리밍을 끈다(2포인트 직선 방지).
  const sparkPeriodDays = isIntradayPeriod(period) ? undefined : periodToDays(period);

  if (variant === "grid") {
    return (
      <article
        className={`stock-flow-card stock-flow-card--grid ${!showPriceChart ? "stock-flow-card--grid-no-chart" : ""}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tabular-nums text-[var(--muted)]">{index + 1}</span>
          <Link href={stockHref} className="flex min-w-0 flex-1 items-center gap-2 hover:opacity-90">
            <StockLogo stockName={flow.stock_name} stockCode={flow.stock_code} size={36} variant="circle" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold hover:text-[var(--accent)]">
                <StockLabel stockName={flow.stock_name} stockCode={flow.stock_code} className="font-semibold" />
              </p>
              <AssetClassTag stockName={flow.stock_name} stockCode={flow.stock_code} />
            </div>
          </Link>
        </div>

        {showPriceChart ? (
          <Link href={stockHref} className="mt-3 block">
            <StockPriceSparkline
              data={priceData}
              stockCode={flow.stock_code}
              fullWidth
              showPerf
              periodDays={sparkPeriodDays}
              hideWhenEmpty
            />
          </Link>
        ) : null}

        <div
          className={`flex items-end justify-between gap-2 border-t border-[var(--border-subtle)] pt-3 ${showPriceChart ? "mt-3" : "mt-2"}`}
        >
          <p className="text-xs text-[var(--muted)]">
            변화 {flow.move_count}건 · 매수 {flow.buy_count} · 매도 {flow.sell_count}
          </p>
          <div className="text-right">
            <p className="text-label">{metric.label}</p>
            <p className={`metric-cell-value ${metric.positive ? "delta-positive" : "delta-negative"}`}>
              {metric.value}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <ManagerTagList moves={flow.moves} collapseLimit={3} labelMode="etfName" />
        </div>
      </article>
    );
  }

  return (
    <article className="stock-flow-card">
      <div className="stock-flow-header">
        <Link href={stockHref} className="stock-flow-identity group">
          <span className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-[var(--muted)]">
            {index + 1}
          </span>
          <StockLogo stockName={flow.stock_name} stockCode={flow.stock_code} size={44} variant="circle" />
          <div className="min-w-0">
            <p className="stock-flow-name group-hover:text-[var(--accent)]">
              <StockLabel stockName={flow.stock_name} stockCode={flow.stock_code} />
              <AssetClassTag
                stockName={flow.stock_name}
                stockCode={flow.stock_code}
                className="ml-1.5 align-middle"
              />
            </p>
            <p className="stock-flow-meta">
              <span className="tabular-nums">{flow.stock_code}</span>
              <span aria-hidden>·</span>
              <span>변화 {flow.move_count}건</span>
              <span aria-hidden>·</span>
              <span className="delta-positive">매수 {flow.buy_count}</span>
              <span aria-hidden>·</span>
              <span className="delta-negative">매도 {flow.sell_count}</span>
            </p>
          </div>
        </Link>

        <div className="stock-flow-metrics">
          {showPriceChart ? (
            <Link
              href={stockHref}
              className="stock-flow-chart"
              aria-label={`${formatStockDisplayName(flow.stock_name, flow.stock_code)} 주가 차트`}
            >
              <StockPriceSparkline
                data={priceData}
                stockCode={flow.stock_code}
                showPerf
                periodDays={sparkPeriodDays}
                hideWhenEmpty
              />
            </Link>
          ) : null}
          <div className="stock-flow-net metric-cell metric-cell--end">
            <p className="text-label">{metric.label}</p>
            <p className={`metric-cell-value ${metric.positive ? "delta-positive" : "delta-negative"}`}>
              {metric.value}
            </p>
            {showSecondaryNetFlow(sort) ? (
              <p className="mt-1 text-xs font-normal tabular-nums text-[var(--muted)]">
                <span>순흐름</span>{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {isPositive ? "+" : "−"}
                  {formatKrw(Math.abs(flow.net_flow_krw))}
                </span>
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="stock-flow-tags">
        <ManagerTagList moves={flow.moves} collapseLimit={4} labelMode="etfName" />
      </div>
    </article>
  );
}
