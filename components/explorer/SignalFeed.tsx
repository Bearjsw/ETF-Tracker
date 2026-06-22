import { SignalCard } from "@/components/explorer/SignalCard";
import type { EtfNameLookup, SignalDaily } from "@/lib/types";

type Props = {
  signals: SignalDaily[];
  etfMap?: EtfNameLookup;
};

export function SignalFeed({ signals, etfMap }: Props) {
  if (!signals.length) {
    return (
      <div className="card">
        <p className="text-sm text-[var(--muted)]">
          시그널이 없습니다. 데이터 파이프라인을 실행하면 액티브 ETF들의 합의 매집·신규편입 패턴이 여기에 표시됩니다.
        </p>
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          <code className="code-inline">collect_daily.py</code> →{" "}
          <code className="code-inline">compute_holdings_diff.py</code> →{" "}
          <code className="code-inline">compute_signals.py</code>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {signals.map((signal) => (
        <SignalCard
          key={`${signal.date}-${signal.stock_code}-${signal.signal_type}-${signal.window_days}`}
          signal={signal}
          etfMap={etfMap}
        />
      ))}
    </div>
  );
}
