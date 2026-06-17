import Link from "next/link";
import type { SignalDaily } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

type Props = {
  signals: SignalDaily[];
};

function signalLabel(type: string) {
  switch (type) {
    case "new_entry":
      return "신규편입";
    case "consensus":
      return "합의";
    default:
      return type;
  }
}

export function SignalFeed({ signals }: Props) {
  if (!signals.length) {
    return <div className="card text-[var(--muted)]">시그널이 없습니다. holdings diff 후 compute_signals를 실행하세요.</div>;
  }

  return (
    <div className="card overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>날짜</th>
            <th>종목</th>
            <th>유형</th>
            <th>방향</th>
            <th>ETF수</th>
            <th>강도</th>
            <th>점수</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((signal) => (
            <tr key={`${signal.date}-${signal.stock_code}-${signal.signal_type}-${signal.window_days}`}>
              <td>{signal.date}</td>
              <td>
                <Link href={`/stocks/${signal.stock_code}`} className="text-[var(--accent)]">
                  {signal.stock_name ?? signal.stock_code}
                </Link>
              </td>
              <td>{signalLabel(signal.signal_type)}</td>
              <td>{signal.direction === "accumulation" ? "매집" : "매도"}</td>
              <td>{signal.etf_count}</td>
              <td>{signal.strength ?? "-"}</td>
              <td>{formatNumber(signal.score, 3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
