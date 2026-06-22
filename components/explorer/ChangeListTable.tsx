import Link from "next/link";
import type { HoldingDiffEnriched } from "@/lib/types";
import { AssetClassTag } from "@/components/explorer/AssetClassTag";
import { EtfSourceTag } from "@/components/explorer/EtfSourceTag";
import { StockLogo } from "@/components/explorer/Logo";
import { StockLabel } from "@/components/explorer/StockLabel";
import {
  changeTypeLabel,
  formatDeltaPp,
  formatKrw,
  formatPercent,
  formatShortDate,
  isAccumulation,
} from "@/lib/utils";

type Props = {
  changes: HoldingDiffEnriched[];
};

export function ChangeListTable({ changes }: Props) {
  if (!changes.length) {
    return (
      <div className="card text-sm text-[var(--muted)]">
        아직 비중 변화 데이터가 없습니다. 운용사 필터가 켜져 있다면 초기화해 보세요.
      </div>
    );
  }

  return (
    <div className="signal-table">
      <div className="signal-table-head">
        <span>종목</span>
        <span>ETF</span>
        <span>비중·흐름</span>
        <span>변화일</span>
      </div>
      {changes.map((change) => {
        const accumulating = isAccumulation(change.change_type, change.weight_delta);
        const perf = change.return_since_change;
        return (
          <Link
            key={`${change.date}-${change.etf_ticker}-${change.stock_code}-${change.change_type}`}
            href={`/stocks/${change.stock_code}`}
            className="signal-table-row group"
          >
            <div className="flex items-start gap-3">
              <StockLogo stockName={change.stock_name} stockCode={change.stock_code} size={40} variant="circle" />
              <div className="min-w-0">
                <p className={`text-sm font-bold ${accumulating ? "delta-positive" : "delta-negative"}`}>
                  {accumulating ? "▲" : "▼"} {changeTypeLabel(change.change_type)}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-base font-semibold underline-offset-2 group-hover:underline">
                  <StockLabel stockName={change.stock_name} stockCode={change.stock_code} />
                  <AssetClassTag stockName={change.stock_name} stockCode={change.stock_code} />
                </p>
                <p className="text-xs text-[var(--muted)]">{change.stock_code}</p>
              </div>
            </div>
            <div className="min-w-0">
              <EtfSourceTag
                etfTicker={change.etf_ticker}
                etfName={change.etf_name}
                manager={change.manager ?? null}
                changeType={change.change_type}
                flowKrw={change.est_flow_krw}
                labelMode="etfName"
              />
            </div>
            <div>
              <p className={`text-sm font-semibold tabular-nums ${accumulating ? "delta-positive" : "delta-negative"}`}>
                {accumulating ? "+" : "−"}
                {formatKrw(Math.abs(change.est_flow_krw ?? 0))}
              </p>
              <p className="mt-1 text-xs tabular-nums text-[var(--muted)]">
                {formatDeltaPp(change.weight_delta)}
                {perf != null ? ` · ${formatPercent(perf, 1, true)}` : ""}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold tabular-nums">{formatShortDate(change.date)}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
