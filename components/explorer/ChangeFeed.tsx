import Link from "next/link";
import type { HoldingDiffEnriched, StockPricePoint } from "@/lib/types";
import { ChangeListTable } from "@/components/explorer/ChangeListTable";
import { MetricCell, MetricValue } from "@/components/explorer/MetricCell";
import { AssetClassTag } from "@/components/explorer/AssetClassTag";
import { EtfSourceTag } from "@/components/explorer/EtfSourceTag";
import { StockLogo } from "@/components/explorer/Logo";
import { StockLabel } from "@/components/explorer/StockLabel";
import { StockPriceSparkline } from "@/components/explorer/StockPriceSparkline";
import { canShowStockPriceChart } from "@/lib/bond-issuer";
import { stockRefKey } from "@/lib/stock-ref";
import {
  changeTypeBadgeClass,
  changeTypeLabel,
  cn,
  formatDeltaPp,
  formatKrw,
  formatNumber,
  formatPercent,
  formatRelativeChangeDate,
  isAccumulation,
  relativeWeightChange,
} from "@/lib/utils";

type Props = {
  changes: HoldingDiffEnriched[];
  priceByStock?: Record<string, StockPricePoint[]>;
  title?: string;
  compact?: boolean;
  layout?: "list" | "tiles" | "grid" | "signal";
  /** ETF 상세 등 — 운용사·추정흐름 태그 숨김 */
  hideSourceTag?: boolean;
  /** 미니 차트 숨김 */
  showSparkline?: boolean;
  logoSize?: number;
};

function badgeClass(type: string) {
  return changeTypeBadgeClass(type);
}

function changePriceKey(change: HoldingDiffEnriched) {
  return stockRefKey({ stock_code: change.stock_code, stock_name: change.stock_name });
}

function hasSparklineData(
  change: HoldingDiffEnriched,
  priceByStock: Record<string, StockPricePoint[]>,
): boolean {
  if (!canShowStockPriceChart(change.stock_name, change.stock_code)) return false;
  const priceKey = changePriceKey(change);
  const data = priceByStock[priceKey] ?? priceByStock[change.stock_code] ?? [];
  return data.length >= 2;
}

function ChangeStats({
  change,
  compact,
  align = "right",
}: {
  change: HoldingDiffEnriched;
  compact: boolean;
  align?: "left" | "right";
}) {
  const accumulating = isAccumulation(change.change_type, change.weight_delta);
  const perf = change.return_since_change;
  const showPriceChart = canShowStockPriceChart(change.stock_name, change.stock_code);
  const cellAlign = align === "left" ? "start" : "end";
  const deltaPositive = (change.weight_delta ?? 0) >= 0;
  const relative = !compact ? relativeWeightChange(change.weight_prev, change.weight_curr) : null;

  return (
    <div className={`change-stats ${align === "left" ? "change-stats--start" : "change-stats--end"}`}>
      <MetricCell label="비중 변화" align={cellAlign}>
        <MetricValue tone={deltaPositive ? "positive" : "negative"}>
          {formatDeltaPp(change.weight_delta)}
        </MetricValue>
        {relative != null ? (
          <p className={`metric-cell-sub ${deltaPositive ? "delta-positive" : "delta-negative"}`}>
            {formatPercent(relative, 1, true)}
          </p>
        ) : null}
      </MetricCell>
      <MetricCell label="추정 흐름" align={cellAlign}>
        <MetricValue tone={accumulating ? "positive" : "negative"}>
          {accumulating ? "+" : "−"}
          {formatKrw(Math.abs(change.est_flow_krw ?? 0))}
        </MetricValue>
      </MetricCell>
      {showPriceChart ? (
        <MetricCell label="변화 후 수익" align={cellAlign}>
          <MetricValue
            tone={perf == null ? "muted" : perf >= 0 ? "positive" : "negative"}
          >
            {perf != null ? formatPercent(perf, 2, true) : "—"}
          </MetricValue>
        </MetricCell>
      ) : null}
    </div>
  );
}

function ChangeTile({
  change,
  priceByStock,
  compact,
}: {
  change: HoldingDiffEnriched;
  priceByStock: Record<string, StockPricePoint[]>;
  compact: boolean;
}) {
  const priceKey = changePriceKey(change);
  const hasChart = hasSparklineData(change, priceByStock);
  return (
    <article className="change-feed-tile card-interactive flex h-full shrink-0 flex-col">
      <div className="flex flex-wrap items-center gap-2">
        <span className={badgeClass(change.change_type)}>{changeTypeLabel(change.change_type)}</span>
        <span className="text-xs text-[var(--muted)]">{change.date}</span>
      </div>

      {hasChart ? (
        <Link href={`/stocks/${change.stock_code}`} className="mt-3 block hover:opacity-90">
          <StockPriceSparkline
            data={priceByStock[priceKey] ?? priceByStock[change.stock_code] ?? []}
            stockCode={change.stock_code}
            fullWidth
            hideWhenEmpty
          />
        </Link>
      ) : (
        <div className="change-feed-tile__chart-spacer" aria-hidden />
      )}

      <Link
        href={`/stocks/${change.stock_code}`}
        className="mt-2 flex flex-wrap items-center gap-2 truncate text-base font-semibold hover:text-[var(--accent)]"
      >
        <StockLogo stockName={change.stock_name} stockCode={change.stock_code} size={28} variant="circle" />
        <StockLabel stockName={change.stock_name} stockCode={change.stock_code} className="truncate" />
        <AssetClassTag stockName={change.stock_name} stockCode={change.stock_code} />
      </Link>

      <div className="mt-2">
        <EtfSourceTag
          etfTicker={change.etf_ticker}
          etfName={change.etf_name}
          manager={change.manager ?? null}
          changeType={change.change_type}
          flowKrw={change.est_flow_krw}
          labelMode="etfName"
        />
      </div>

      <div className="change-feed-tile__grow" aria-hidden />

      <div className="change-feed-tile__footer">
        <ChangeStats change={change} compact={compact} align="left" />
      </div>
    </article>
  );
}

function ChangeListRow({
  change,
  priceByStock,
  compact,
  hideSourceTag,
  showSparkline,
  logoSize,
}: {
  change: HoldingDiffEnriched;
  priceByStock: Record<string, StockPricePoint[]>;
  compact: boolean;
  hideSourceTag: boolean;
  showSparkline: boolean;
  logoSize: number;
}) {
  const priceKey = changePriceKey(change);
  const sparkData = priceByStock[priceKey] ?? priceByStock[change.stock_code] ?? [];
  const hasChart = showSparkline && hasSparklineData(change, priceByStock);
  return (
    <div
      key={`${change.date}-${change.etf_ticker}-${change.stock_code}-${change.change_type}`}
      className="card-interactive flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={badgeClass(change.change_type)}>{changeTypeLabel(change.change_type)}</span>
          <span className="text-xs text-[var(--muted)]">{formatRelativeChangeDate(change.date)}</span>
        </div>
        <Link
          href={`/stocks/${change.stock_code}`}
          className="mt-2 flex items-center gap-3 hover:opacity-90"
        >
          <StockLogo stockName={change.stock_name} stockCode={change.stock_code} size={logoSize} variant="circle" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-base font-semibold hover:text-[var(--accent)]">
                <StockLabel stockName={change.stock_name} stockCode={change.stock_code} />
              </span>
              <AssetClassTag stockName={change.stock_name} stockCode={change.stock_code} />
            </div>
            {hasChart ? (
              <div className="mt-1.5">
                <StockPriceSparkline data={sparkData} stockCode={change.stock_code} hideWhenEmpty />
              </div>
            ) : null}
          </div>
        </Link>
        {!hideSourceTag ? (
          <div className="mt-2">
            <EtfSourceTag
              etfTicker={change.etf_ticker}
              manager={change.manager ?? null}
              changeType={change.change_type}
              flowKrw={change.est_flow_krw}
            />
          </div>
        ) : null}
        {!compact ? (
          <p className="mt-2 text-xs tabular-nums text-[var(--muted)]">
            {formatNumber(change.weight_prev, 2)}% → {formatNumber(change.weight_curr, 2)}%
          </p>
        ) : null}
      </div>

      <div className="shrink-0 sm:min-w-[18rem]">
        <ChangeStats change={change} compact={compact} align="right" />
      </div>
    </div>
  );
}

export function ChangeFeed({
  changes,
  priceByStock = {},
  title,
  compact = false,
  layout = "list",
  hideSourceTag = false,
  showSparkline = true,
  logoSize = 32,
}: Props) {
  if (!changes.length) {
    return (
      <div className="card">
        {title ? <h2 className="section-title mb-2">{title}</h2> : null}
        <p className="text-sm text-[var(--muted)]">
          아직 비중 변화 데이터가 없습니다. 운용사 필터가 켜져 있다면 초기화해 보세요.{" "}
          데이터가 없다면{" "}
          <code className="code-inline">python scripts/run_pipeline.py</code> 로 샘플 데이터를 생성하거나,{" "}
          <code className="code-inline">collect_daily.py</code> →{" "}
          <code className="code-inline">compute_holdings_diff.py</code> 로 실제 KRX 데이터를 수집하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {title ? <h2 className="section-title">{title}</h2> : null}
      {layout === "signal" ? (
        <ChangeListTable changes={changes} />
      ) : layout === "tiles" ? (
        <div className="change-feed-scroll">
          <div className="change-feed-tiles">
            {changes.map((change) => (
              <ChangeTile
                key={`${change.date}-${change.etf_ticker}-${change.stock_code}-${change.change_type}`}
                change={change}
                priceByStock={priceByStock}
                compact={compact}
              />
            ))}
          </div>
        </div>
      ) : layout === "grid" ? (
        <div className="change-feed-grid">
          {changes.map((change) => (
            <ChangeTile
              key={`${change.date}-${change.etf_ticker}-${change.stock_code}-${change.change_type}`}
              change={change}
              priceByStock={priceByStock}
              compact={compact}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {changes.map((change) => (
            <ChangeListRow
              key={`${change.date}-${change.etf_ticker}-${change.stock_code}-${change.change_type}`}
              change={change}
              priceByStock={priceByStock}
              compact={compact}
              hideSourceTag={hideSourceTag}
              showSparkline={showSparkline}
              logoSize={logoSize}
            />
          ))}
        </div>
      )}
    </div>
  );
}
