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
  /** 제목 오른쪽 ↑증가 · ↓감소 건수 */
  titleStats?: { up: number; down: number };
  compact?: boolean;
  layout?: "list" | "tiles" | "grid" | "signal";
  /** ETF 상세 등 — 운용사·추정흐름 태그 숨김 */
  hideSourceTag?: boolean;
  /** 미니 차트 숨김 */
  showSparkline?: boolean;
  logoSize?: number;
  /** 항목마다 카드 대신 하나의 card 안에 목록 */
  unifiedCard?: boolean;
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

/** 가장 최근 거래일과 그 전일 종가로 1일 등락률(%) 계산 */
function lastDayChangePct(data: StockPricePoint[]): number | null {
  if (data.length < 2) return null;
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1].close;
  const prev = sorted[sorted.length - 2].close;
  if (!prev || prev <= 0) return null;
  return ((last - prev) / prev) * 100;
}

function ChangeStats({
  change,
  compact,
  align = "right",
  dayChangePct = null,
}: {
  change: HoldingDiffEnriched;
  compact: boolean;
  align?: "left" | "right";
  /** 전일 대비 1일 등락률(%) */
  dayChangePct?: number | null;
}) {
  const accumulating = isAccumulation(change.change_type, change.weight_delta);
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
        <MetricCell label="전일 대비" align={cellAlign}>
          <MetricValue
            tone={dayChangePct == null ? "muted" : dayChangePct >= 0 ? "positive" : "negative"}
          >
            {dayChangePct != null ? formatPercent(dayChangePct, 2, true) : "—"}
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
  const sparkData = priceByStock[priceKey] ?? priceByStock[change.stock_code] ?? [];
  const hasChart = hasSparklineData(change, priceByStock);
  const dayChangePct = lastDayChangePct(sparkData);
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
        <ChangeStats change={change} compact={compact} align="left" dayChangePct={dayChangePct} />
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
  unified,
}: {
  change: HoldingDiffEnriched;
  priceByStock: Record<string, StockPricePoint[]>;
  compact: boolean;
  hideSourceTag: boolean;
  showSparkline: boolean;
  logoSize: number;
  unified?: boolean;
}) {
  const priceKey = changePriceKey(change);
  const sparkData = priceByStock[priceKey] ?? priceByStock[change.stock_code] ?? [];
  const hasChart = showSparkline && hasSparklineData(change, priceByStock);
  const dayChangePct = lastDayChangePct(sparkData);

  if (unified) {
    return (
      <div
        key={`${change.date}-${change.etf_ticker}-${change.stock_code}-${change.change_type}`}
        className="change-feed-unified-row flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={badgeClass(change.change_type)}>{changeTypeLabel(change.change_type)}</span>
            <span className="text-xs text-[var(--muted)]">{formatRelativeChangeDate(change.date)}</span>
          </div>
          <Link href={`/stocks/${change.stock_code}`} className="mt-2 flex items-center gap-3 hover:opacity-90">
            <StockLogo stockName={change.stock_name} stockCode={change.stock_code} size={logoSize} variant="circle" />
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate text-base font-semibold hover:text-[var(--accent)]">
                <StockLabel stockName={change.stock_name} stockCode={change.stock_code} />
              </span>
              <AssetClassTag stockName={change.stock_name} stockCode={change.stock_code} />
            </div>
          </Link>
        </div>
        <div className="shrink-0 sm:min-w-[16rem]">
          <ChangeStats change={change} compact={compact} align="right" dayChangePct={dayChangePct} />
        </div>
      </div>
    );
  }

  return (
    <div
      key={`${change.date}-${change.etf_ticker}-${change.stock_code}-${change.change_type}`}
      className="change-feed-row card-interactive"
    >
      <Link
        href={`/stocks/${change.stock_code}`}
        className="change-feed-row__id group min-w-0 flex-1"
      >
        <StockLogo stockName={change.stock_name} stockCode={change.stock_code} size={logoSize} variant="circle" />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[0.95rem] font-semibold group-hover:text-[var(--accent)]">
              <StockLabel stockName={change.stock_name} stockCode={change.stock_code} />
            </span>
            <AssetClassTag stockName={change.stock_name} stockCode={change.stock_code} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--muted)]">
            <span className={badgeClass(change.change_type)}>{changeTypeLabel(change.change_type)}</span>
            {!compact ? (
              <span className="tabular-nums">
                {formatNumber(change.weight_prev, 2)}% → {formatNumber(change.weight_curr, 2)}%
              </span>
            ) : null}
            <span>{formatRelativeChangeDate(change.date)}</span>
          </div>
        </div>
      </Link>

      {!hideSourceTag ? (
        <div className="change-feed-row__etf hidden shrink-0 lg:block">
          <EtfSourceTag
            etfTicker={change.etf_ticker}
            etfName={change.etf_name}
            manager={change.manager ?? null}
            changeType={change.change_type}
            flowKrw={change.est_flow_krw}
            labelMode="etfName"
          />
        </div>
      ) : null}

      {hasChart ? (
        <Link href={`/stocks/${change.stock_code}`} className="hidden shrink-0 xl:block">
          <StockPriceSparkline data={sparkData} stockCode={change.stock_code} hideWhenEmpty />
        </Link>
      ) : null}

      <div className="change-feed-row__stats shrink-0">
        <ChangeStats change={change} compact={compact} align="right" dayChangePct={dayChangePct} />
      </div>
    </div>
  );
}

function ChangeFeedHeader({
  title,
  titleStats,
  className,
}: {
  title: string;
  titleStats?: { up: number; down: number };
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 ${className ?? ""}`}>
      <h2 className="section-title">{title}</h2>
      {titleStats && (titleStats.up > 0 || titleStats.down > 0) ? (
        <div className="change-feed-title-stats text-sm font-semibold tabular-nums">
          {titleStats.up > 0 ? (
            <span className="delta-weight-up">↑{titleStats.up} 증가</span>
          ) : null}
          {titleStats.down > 0 ? (
            <span className="delta-weight-down">↓{titleStats.down} 감소</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ChangeFeed({
  changes,
  priceByStock = {},
  title,
  titleStats,
  compact = false,
  layout = "list",
  hideSourceTag = false,
  showSparkline = true,
  logoSize = 32,
  unifiedCard = false,
}: Props) {
  if (!changes.length) {
    return (
      <div className="card">
        {title ? <ChangeFeedHeader title={title} titleStats={titleStats} /> : null}
        <p className="mt-2 text-sm text-[var(--muted)]">
          아직 비중 변화 데이터가 없습니다. 운용사 필터가 켜져 있다면 초기화해 보세요.{" "}
          데이터가 없다면{" "}
          <code className="code-inline">python scripts/run_pipeline.py</code> 로 샘플 데이터를 생성하거나,{" "}
          <code className="code-inline">collect_daily.py</code> →{" "}
          <code className="code-inline">compute_holdings_diff.py</code> 로 실제 KRX 데이터를 수집하세요.
        </p>
      </div>
    );
  }

  const listContent = (
    <div className={unifiedCard ? "change-feed-unified-list" : "space-y-2"}>
      {changes.map((change) => (
        <ChangeListRow
          key={`${change.date}-${change.etf_ticker}-${change.stock_code}-${change.change_type}`}
          change={change}
          priceByStock={priceByStock}
          compact={compact}
          hideSourceTag={hideSourceTag}
          showSparkline={showSparkline}
          logoSize={logoSize}
          unified={unifiedCard}
        />
      ))}
    </div>
  );

  const body =
    layout === "signal" ? (
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
      listContent
    );

  if (unifiedCard) {
    return (
      <div className="card">
        {title ? <ChangeFeedHeader title={title} titleStats={titleStats} className="mb-3" /> : null}
        {body}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {title ? <ChangeFeedHeader title={title} titleStats={titleStats} /> : null}
      {body}
    </div>
  );
}
