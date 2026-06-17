import Link from "next/link";
import type { EtfListItem } from "@/lib/types";
import { formatKrw, strategyLabel } from "@/lib/utils";

type Props = {
  etfs: EtfListItem[];
};

export function EtfList({ etfs }: Props) {
  if (!etfs.length) {
    return <div className="card text-[var(--muted)]">표시할 ETF가 없습니다. universe 시드를 먼저 실행하세요.</div>;
  }

  return (
    <div className="card overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>티커</th>
            <th>이름</th>
            <th>운용사</th>
            <th>유형</th>
            <th>시장</th>
            <th>AUM</th>
            <th>변화건수</th>
          </tr>
        </thead>
        <tbody>
          {etfs.map((etf) => (
            <tr key={etf.ticker} className="hover:bg-white/5">
              <td>
                <Link href={`/etfs/${etf.ticker}`} className="text-[var(--accent)]">
                  {etf.ticker}
                </Link>
              </td>
              <td>{etf.name}</td>
              <td>
                {etf.manager ? (
                  <Link href={`/managers/${encodeURIComponent(etf.manager)}`}>{etf.manager}</Link>
                ) : (
                  "-"
                )}
              </td>
              <td>{strategyLabel(etf.strategy_type)}</td>
              <td>{etf.market ?? "-"}</td>
              <td>{formatKrw(etf.latest_aum)}</td>
              <td>{etf.change_count ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
