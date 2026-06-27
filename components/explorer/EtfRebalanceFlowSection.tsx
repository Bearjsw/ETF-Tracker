"use client";

import Link from "next/link";
import { EtfCategoryTag } from "@/components/explorer/EtfCategoryTag";
import { ManagerFlowPanel } from "@/components/explorer/ManagerFlowPanel";
import { REBALANCE_FLOW_FOOTNOTE, SUBSCRIPTION_FLOW_FOOTNOTE } from "@/lib/est-flow";
import type { EtfFlowSnapshot } from "@/lib/types";
import { formatKrw, formatManagerShort } from "@/lib/utils";

type Props = {
  snapshot: EtfFlowSnapshot;
  manager?: string;
};

function RebalanceLeaderPanel({
  title,
  rows,
  positive,
}: {
  title: string;
  rows: EtfFlowSnapshot["topInflow"];
  positive: boolean;
}) {
  if (!rows.length) {
    return (
      <div className="etf-flow-panel">
        <h3 className="etf-flow-panel__title">{title}</h3>
        <p className="text-xs text-[var(--muted)]">데이터 없음</p>
      </div>
    );
  }

  return (
    <div className="etf-flow-panel">
      <h3 className="etf-flow-panel__title">{title}</h3>
      <ol className="etf-flow-leader-list">
        {rows.map((row, i) => (
          <li key={row.ticker} className="etf-flow-leader-list__item">
            <span className="etf-flow-leader-list__rank">{i + 1}</span>
            <div className="etf-flow-leader-list__main">
              <Link href={`/etfs/${row.ticker}`} className="etf-flow-leader-list__name">
                {row.name}
              </Link>
              <div className="etf-flow-leader-list__meta">
                <EtfCategoryTag assetClass={row.asset_class} />
                {row.manager ? (
                  <span className="etf-flow-leader-list__manager">{formatManagerShort(row.manager)}</span>
                ) : null}
              </div>
            </div>
            <span className={`etf-flow-leader-list__amt ${positive ? "delta-positive" : "delta-negative"}`}>
              {positive ? "+" : "−"}
              {formatKrw(Math.abs(row.net_flow_krw))}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function EtfRebalanceFlowSection({ snapshot, manager }: Props) {
  const inRows = snapshot.topInflow.slice(0, 5);
  const outRows = snapshot.topOutflow.slice(0, 5);

  const hasManagerFlow =
    snapshot.topManagerInflow.length > 0 || snapshot.topManagerOutflow.length > 0;

  return (
    <div className="rebalance-flow-stack">
      <section className="card rebalance-flow-block">
        <h2 className="rebalance-flow-heading">ETF 리밸런싱 추정</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {REBALANCE_FLOW_FOOTNOTE} · 최근 {snapshot.windowDays}일
          {manager ? ` · ${manager}` : null}
          {" · "}
          {SUBSCRIPTION_FLOW_FOOTNOTE}는{" "}
          <Link href="/market" className="font-medium text-[var(--accent)] hover:underline">
            시장
          </Link>
          에서 확인
        </p>

        <div className="rebalance-flow-summary">
          <div className="rebalance-flow-summary-card">
            <p className="text-label">유입</p>
            <p className="rebalance-flow-summary-card__value delta-positive">
              +{formatKrw(snapshot.totalInflow)}
            </p>
          </div>
          <div className="rebalance-flow-summary-card">
            <p className="text-label">유출</p>
            <p className="rebalance-flow-summary-card__value delta-negative">
              −{formatKrw(snapshot.totalOutflow)}
            </p>
          </div>
        </div>
      </section>

      <section className="card rebalance-flow-block">
        <h2 className="rebalance-flow-heading">ETF 순매수·순매도 추정</h2>
        <div className="rebalance-flow-block__content grid grid-cols-2 gap-4">
          <RebalanceLeaderPanel title="순매수 추정 TOP" rows={inRows} positive />
          <RebalanceLeaderPanel title="순매도 추정 TOP" rows={outRows} positive={false} />
        </div>
      </section>

      {hasManagerFlow ? (
        <section className="card rebalance-flow-block">
          <h2 className="rebalance-flow-heading">운용사 순매수·순매도 추정</h2>
          <div className="rebalance-flow-block__content grid grid-cols-2 gap-4">
            <ManagerFlowPanel
              title="운용사 순매수 추정"
              rows={snapshot.topManagerInflow.slice(0, 3)}
              positive
            />
            <ManagerFlowPanel
              title="운용사 순매도 추정"
              rows={snapshot.topManagerOutflow.slice(0, 3)}
              positive={false}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
