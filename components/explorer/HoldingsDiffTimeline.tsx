import Link from "next/link";
import type { HoldingDiff } from "@/lib/types";
import { changeTypeLabel, formatKrw, formatNumber } from "@/lib/utils";

type Props = {
  diffs: HoldingDiff[];
  title?: string;
};

function badgeClass(type: string) {
  switch (type) {
    case "new":
      return "badge badge-new";
    case "removed":
      return "badge badge-removed";
    case "weight_up":
      return "badge badge-up";
    default:
      return "badge badge-down";
  }
}

export function HoldingsDiffTimeline({ diffs, title = "보유 변화" }: Props) {
  if (!diffs.length) {
    return <div className="card text-[var(--muted)]">보유 변화 이력이 없습니다.</div>;
  }

  return (
    <div className="card overflow-x-auto">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <table>
        <thead>
          <tr>
            <th>날짜</th>
            <th>종목</th>
            <th>변화</th>
            <th>이전비중</th>
            <th>현재비중</th>
            <th>추정금액</th>
          </tr>
        </thead>
        <tbody>
          {diffs.map((diff) => (
            <tr key={`${diff.date}-${diff.stock_code}-${diff.change_type}`}>
              <td>{diff.date}</td>
              <td>
                <Link href={`/stocks/${diff.stock_code}`} className="text-[var(--accent)]">
                  {diff.stock_name ?? diff.stock_code}
                </Link>
              </td>
              <td>
                <span className={badgeClass(diff.change_type)}>{changeTypeLabel(diff.change_type)}</span>
              </td>
              <td>{formatNumber(diff.weight_prev, 2)}</td>
              <td>{formatNumber(diff.weight_curr, 2)}</td>
              <td>{formatKrw(diff.est_flow_krw)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
