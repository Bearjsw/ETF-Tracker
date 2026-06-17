import Link from "next/link";
import type { HoldingDaily } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

type Props = {
  holdings: HoldingDaily[];
  latestDate?: string;
};

export function HoldingsTable({ holdings, latestDate }: Props) {
  const rows = latestDate
    ? holdings.filter((h) => h.date === latestDate)
    : holdings.slice(0, 50);

  if (!rows.length) {
    return <div className="card text-[var(--muted)]">보유종목 데이터가 없습니다.</div>;
  }

  return (
    <div className="card overflow-x-auto">
      <h2 className="mb-3 text-lg font-semibold">보유종목 {latestDate ? `(${latestDate})` : ""}</h2>
      <table>
        <thead>
          <tr>
            <th>종목코드</th>
            <th>종목명</th>
            <th>비중(%)</th>
            <th>수량</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.stock_code}-${row.date}`}>
              <td>
                <Link href={`/stocks/${row.stock_code}`} className="text-[var(--accent)]">
                  {row.stock_code}
                </Link>
              </td>
              <td>{row.stock_name ?? "-"}</td>
              <td>{formatNumber(row.weight, 2)}</td>
              <td>{formatNumber(row.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
