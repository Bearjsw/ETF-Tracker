import Link from "next/link";
import { StockLabel } from "@/components/explorer/StockLabel";
import type { EtfNameLookup, SignalDaily } from "@/lib/types";
import { ManagerTagList } from "@/components/explorer/ManagerTagList";
import { formatNumber, signalTypeLabel, strengthLabel } from "@/lib/utils";

type Props = {
  signal: SignalDaily;
  etfMap?: EtfNameLookup;
};

export function SignalCard({ signal, etfMap }: Props) {
  const isAccumulation = signal.direction === "accumulation";

  return (
    <div className="card-interactive">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${isAccumulation ? "badge-up" : "badge-down"}`}>
              {signalTypeLabel(signal.signal_type, signal.direction)}
            </span>
            <span className="text-xs text-[var(--muted)]">{signal.date}</span>
            <span className="text-xs text-[var(--muted)]">· {signal.window_days}일 윈도우</span>
          </div>
          <Link href={`/stocks/${signal.stock_code}`} className="mt-2 block text-lg font-semibold hover:text-[var(--accent)]">
            <StockLabel stockName={signal.stock_name} stockCode={signal.stock_code} />
          </Link>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {isAccumulation ? "매집" : "매도"} · {signal.etf_count}개 ETF {isAccumulation ? "동시 확대" : "동시 축소"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-label">강도</p>
          <p className="mt-1 text-sm font-semibold">{strengthLabel(signal.strength)}</p>
          <p className="mt-2 text-label">점수</p>
          <p className="mt-1 text-sm font-semibold tabular-nums">{formatNumber(signal.score, 2)}</p>
        </div>
      </div>

      {signal.etf_tickers?.length ? (
        <div className="mt-4">
          <ManagerTagList tickers={signal.etf_tickers} etfMap={etfMap} collapseLimit={4} />
        </div>
      ) : null}
    </div>
  );
}
