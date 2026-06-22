import Link from "next/link";
import type { HoldingDaily } from "@/lib/types";
import { AssetClassTag } from "@/components/explorer/AssetClassTag";
import { StockLabel } from "@/components/explorer/StockLabel";
import { latestHoldingsSorted } from "@/lib/holdings";
import { WeightBar } from "@/components/explorer/WeightBar";
import { formatNumber } from "@/lib/utils";

type Props = {
  holdings: HoldingDaily[];
  latestDate?: string;
};

export function HoldingsTable({ holdings, latestDate }: Props) {
  const rows = latestHoldingsSorted(holdings);
  const date = latestDate ?? rows[0]?.date;
  const maxWeight = rows[0]?.weight ?? 15;

  if (!rows.length) {
    return null;
  }

  return (
    <div className="card overflow-x-auto">
      <h2 className="section-title mb-3">전체 보유종목 {date ? `(${date})` : ""}</h2>
      <p className="mb-4 text-sm text-[var(--muted)]">비중 높은 순으로 정렬됩니다.</p>
      <table>
        <thead>
          <tr>
            <th>순위</th>
            <th>종목</th>
            <th>비중</th>
            <th>수량</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.stock_code}-${row.date}`}>
              <td className="text-[var(--muted)]">{index + 1}</td>
              <td>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link href={`/stocks/${row.stock_code}`} className="text-[var(--accent)]">
                    <StockLabel stockName={row.stock_name} stockCode={row.stock_code} />
                  </Link>
                  <AssetClassTag stockName={row.stock_name} stockCode={row.stock_code} />
                </div>
                <div className="text-xs text-[var(--muted)]">{row.stock_code}</div>
              </td>
              <td>
                <WeightBar weight={row.weight} maxWeight={maxWeight} />
              </td>
              <td>{formatNumber(row.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
