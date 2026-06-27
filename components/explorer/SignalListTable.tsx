import Link from "next/link";
import { AssetClassTag } from "@/components/explorer/AssetClassTag";
import { StockLogo } from "@/components/explorer/Logo";
import { StockLabel } from "@/components/explorer/StockLabel";
import type { EtfNameLookup, SignalDaily } from "@/lib/types";
import { formatManagerShort, formatShortDate, signalTypeLabel, strengthLabel } from "@/lib/utils";

type Props = {
  signals: SignalDaily[];
  etfMap: EtfNameLookup;
};

function strengthClass(strength: string | null | undefined) {
  switch (strength) {
    case "high":
    case "strong":
      return "strength-high";
    case "medium":
    case "moderate":
      return "strength-medium";
    default:
      return "strength-low";
  }
}

function managerSummary(tickers: string[], etfMap: EtfNameLookup) {
  const managers = [...new Set(tickers.map((t) => etfMap[t]?.manager).filter(Boolean) as string[])];
  if (!managers.length) return { count: 0, text: "—" };
  const short = managers.map(formatManagerShort);
  if (short.length <= 2) return { count: short.length, text: short.join(", ") };
  return { count: managers.length, text: `${short.slice(0, 2).join(", ")} 외 ${short.length - 2}곳` };
}

export function SignalListTable({ signals, etfMap }: Props) {
  if (!signals.length) {
    return (
      <div className="card text-sm text-[var(--muted)]">
        조건에 맞는 시그널이 없습니다. 필터를 초기화하거나 데이터 파이프라인을 실행해 보세요.
      </div>
    );
  }

  return (
    <div className="signal-table">
      <div className="signal-table-head">
        <span className="signal-table-col signal-table-col--stock">종목</span>
        <span className="signal-table-col signal-table-col--managers">참여 운용사</span>
        <span className="signal-table-col signal-table-col--strength signal-table-col--end">합의 강도</span>
        <span className="signal-table-col signal-table-col--period signal-table-col--end">시그널 기간</span>
      </div>
      {signals.map((signal) => {
        const isUp = signal.direction === "accumulation";
        const managers = managerSummary(signal.etf_tickers ?? [], etfMap);
        return (
          <Link
            key={`${signal.date}-${signal.stock_code}-${signal.signal_type}-${signal.window_days}`}
            href={`/stocks/${signal.stock_code}`}
            className="signal-table-row group"
          >
            <div className="signal-table-col signal-table-col--stock flex min-w-0 items-start gap-3">
              <StockLogo stockName={signal.stock_name} stockCode={signal.stock_code} size={40} variant="circle" />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold ${isUp ? "delta-positive" : "delta-negative"}`}>
                  {isUp ? "▲" : "▼"} {signalTypeLabel(signal.signal_type, signal.direction)}
                </p>
                <p className="mt-1 flex min-w-0 items-center gap-1.5 text-base font-semibold underline-offset-2 group-hover:underline">
                  <span className="min-w-0 truncate">
                    <StockLabel stockName={signal.stock_name} stockCode={signal.stock_code} />
                  </span>
                  <AssetClassTag
                    stockName={signal.stock_name}
                    stockCode={signal.stock_code}
                    className="shrink-0"
                  />
                </p>
                <p className="text-xs text-[var(--muted)]">{signal.stock_code}</p>
              </div>
            </div>
            <div className="signal-table-col signal-table-col--managers min-w-0">
              <p className="text-sm font-semibold tabular-nums">{managers.count}곳</p>
              <p className="signal-table-managers-detail mt-0.5">{managers.text}</p>
            </div>
            <div className="signal-table-col signal-table-col--strength signal-table-col--end signal-strength-tags">
              <span className={`strength-badge ${strengthClass(signal.strength)}`}>
                {strengthLabel(signal.strength)}
              </span>
              {signal.signal_type === "consensus" ? (
                <span className="consensus-badge">전원 합의</span>
              ) : null}
            </div>
            <div className="signal-table-col signal-table-col--period signal-table-col--end">
              <p className="text-sm font-semibold tabular-nums">{formatShortDate(signal.date)}</p>
              {signal.window_days > 1 ? (
                <span className="signal-table-period-badge mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold">
                  {signal.window_days}일 연속
                </span>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
