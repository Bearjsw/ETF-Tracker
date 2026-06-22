import Link from "next/link";
import type { EtfFlowSnapshot } from "@/lib/types";
import { formatKrw, formatManagerShort } from "@/lib/utils";
import { EtfCategoryTag } from "@/components/explorer/EtfCategoryTag";
import { ManagerFlowPanel } from "@/components/explorer/ManagerFlowPanel";

type Props = {
  snapshot: EtfFlowSnapshot;
  manager?: string;
};

function FlowLeaderTable({
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
        <p className="text-xs text-[var(--muted)]">해당 기간 데이터 없음</p>
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
            <div className="min-w-0 flex-1">
              <Link href={`/etfs/${row.ticker}`} className="etf-flow-leader-list__name">
                {row.name}
              </Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-[var(--muted)]">{row.ticker}</span>
                <EtfCategoryTag assetClass={row.asset_class} />
                {row.manager ? (
                  <span className="text-[10px] text-[var(--muted)]">
                    {formatManagerShort(row.manager)}
                  </span>
                ) : null}
              </div>
            </div>
            <span
              className={`etf-flow-leader-list__amt tabular-nums ${positive ? "delta-positive" : "delta-negative"}`}
            >
              {positive ? "+" : "−"}
              {formatKrw(Math.abs(row.net_flow_krw))}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function EtfFlowSummarySection({ snapshot, manager }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="section-title">ETF별 리밸런싱 흐름</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            최근 {snapshot.windowDays}일 · 보유 비중 변화 추정 · 유입 {formatKrw(snapshot.totalInflow)} · 유출{" "}
            {formatKrw(snapshot.totalOutflow)}
            {manager ? ` · ${manager}` : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FlowLeaderTable title="순매수 추정 TOP" rows={snapshot.topInflow} positive />
        <FlowLeaderTable title="순매도 추정 TOP" rows={snapshot.topOutflow} positive={false} />
      </div>

      {(snapshot.topManagerInflow.length > 0 || snapshot.topManagerOutflow.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ManagerFlowPanel title="운용사 순매수" rows={snapshot.topManagerInflow.slice(0, 5)} positive />
          <ManagerFlowPanel title="운용사 순매도" rows={snapshot.topManagerOutflow.slice(0, 5)} positive={false} />
        </div>
      )}

      <p className="text-xs leading-relaxed text-[var(--muted)]">
        보유 비중 변화(look-through) 기반 추정입니다. 설정·환매 자금은 위 Δ상장좌수×NAV 섹션을 참고하세요.
        종목별 매매 흐름은 아래 목록에서 확인할 수 있습니다.
      </p>
    </section>
  );
}
