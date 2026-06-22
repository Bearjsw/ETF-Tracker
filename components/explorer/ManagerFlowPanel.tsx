import Link from "next/link";
import { ManagerLogo } from "@/components/explorer/Logo";
import type { ManagerFlowLeader } from "@/lib/types";
import { formatKrw, formatManagerShort } from "@/lib/utils";

type Props = {
  title: string;
  rows: ManagerFlowLeader[];
  positive: boolean;
};

export function ManagerFlowPanel({ title, rows, positive }: Props) {
  if (!rows.length) {
    return (
      <div className="etf-flow-panel">
        <h3 className="etf-flow-panel__title">{title}</h3>
        <p className="text-xs text-[var(--muted)]">데이터 없음</p>
      </div>
    );
  }

  const maxFlow = Math.max(...rows.map((r) => Math.abs(r.net_flow_krw)), 1);

  return (
    <div className="etf-flow-panel manager-flow-panel">
      <h3 className="etf-flow-panel__title">{title}</h3>
      <ol className="manager-flow-list">
        {rows.map((row, i) => {
          const magnitude = Math.abs(row.net_flow_krw);
          const barPct = Math.max(8, Math.round((magnitude / maxFlow) * 100));

          return (
            <li key={row.manager} className="manager-flow-list__item">
              <span className="etf-flow-leader-list__rank">{i + 1}</span>
              <ManagerLogo manager={row.manager} size={32} variant="circle" className="manager-flow-list__logo" />
              <div className="manager-flow-list__body">
                <Link
                  href={`/managers/${encodeURIComponent(row.manager)}`}
                  className="manager-flow-list__name hover:text-[var(--accent)]"
                >
                  {formatManagerShort(row.manager)}
                </Link>
                {row.etf_count > 0 ? (
                  <span className="manager-flow-list__meta">{row.etf_count}개 ETF</span>
                ) : null}
                <div className="manager-flow-bar" aria-hidden>
                  <div
                    className={`manager-flow-bar__fill ${positive ? "manager-flow-bar__fill--in" : "manager-flow-bar__fill--out"}`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>
              <span
                className={`manager-flow-list__amt tabular-nums ${positive ? "delta-positive" : "delta-negative"}`}
              >
                {positive ? "+" : "−"}
                {formatKrw(magnitude)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
