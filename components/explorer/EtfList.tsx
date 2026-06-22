import Link from "next/link";
import type { EtfListItem, EtfNavPoint } from "@/lib/types";
import { EtfCategoryTag } from "@/components/explorer/EtfCategoryTag";
import { EtfNavSparkline } from "@/components/explorer/EtfNavSparkline";
import { formatDeltaPp, formatKrw, formatManagerShort, strategyLabel } from "@/lib/utils";

type Props = {
  etfs: EtfListItem[];
  navByTicker?: Record<string, EtfNavPoint[]>;
};

export function EtfList({ etfs, navByTicker = {} }: Props) {
  if (!etfs.length) {
    return <div className="card text-sm text-[var(--muted)]">표시할 ETF가 없습니다.</div>;
  }

  const sorted = [...etfs].sort((a, b) => (b.change_count ?? 0) - (a.change_count ?? 0));

  return (
    <div className="card overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>ETF</th>
            <th>3달 추이</th>
            <th>유형</th>
            <th>운용사</th>
            <th>AUM</th>
            <th>비중 변화</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((etf) => (
            <tr key={etf.ticker}>
              <td>
                <Link href={`/etfs/${etf.ticker}`} className="font-medium hover:text-[var(--accent)]">
                  {etf.name}
                </Link>
                <div className="text-xs text-[var(--muted)]">{etf.ticker}</div>
              </td>
              <td>
                <Link href={`/etfs/${etf.ticker}`}>
                  <EtfNavSparkline
                    data={navByTicker[etf.ticker] ?? []}
                    ticker={etf.ticker}
                    showPerf
                  />
                </Link>
              </td>
              <td>
                <div className="flex flex-wrap items-center gap-1">
                  <EtfCategoryTag etfName={etf.name} />
                  <span className={`badge ${etf.strategy_type === "active" ? "badge-up" : ""}`}>
                    {strategyLabel(etf.strategy_type)}
                  </span>
                </div>
              </td>
              <td className="text-sm text-[var(--muted)]">
                {etf.manager ? (
                  <Link href={`/managers/${encodeURIComponent(etf.manager)}`} className="hover:text-[var(--foreground)]">
                    {formatManagerShort(etf.manager)}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="tabular-nums text-sm">{formatKrw(etf.latest_aum)}</td>
              <td>
                <span className="font-semibold tabular-nums text-[var(--accent)]">{etf.change_count ?? 0}</span>
                <span className="ml-1 text-xs text-[var(--muted)]">건</span>
                {etf.recent_delta_sum != null ? (
                  <div className="text-xs text-[var(--muted)]">{formatDeltaPp(etf.recent_delta_sum)} 누적</div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
