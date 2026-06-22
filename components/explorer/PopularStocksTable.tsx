import Link from "next/link";
import { AssetClassTag } from "@/components/explorer/AssetClassTag";
import { StockLabel } from "@/components/explorer/StockLabel";
import { StockLogo } from "@/components/explorer/Logo";
import type { PopularStock } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

type Props = {
  stocks: PopularStock[];
  emptyMessage?: string;
};

export function PopularStocksTable({ stocks, emptyMessage }: Props) {
  if (!stocks.length) {
    return (
      <div className="card text-[var(--muted)]">
        {emptyMessage ??
          "집계할 보유종목 데이터가 없습니다. universe 시드 후 collect_daily.py로 보유 스냅샷을 수집하세요."}
      </div>
    );
  }

  return (
    <div className="card popular-stocks-table overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>종목</th>
            <th className="popular-stocks-table__etf-count">담은 ETF 수</th>
            <th>평균 비중</th>
            <th>최대 비중</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((stock, index) => (
            <tr key={stock.stock_code} className="hover:bg-[#f7f8f5]">
              <td className="text-[var(--muted)]">{index + 1}</td>
              <td>
                <Link
                  href={`/stocks/${stock.stock_code}`}
                  className="flex items-center gap-3 hover:opacity-90"
                >
                  <StockLogo
                    stockName={stock.stock_name}
                    stockCode={stock.stock_code}
                    size={44}
                    variant="circle"
                  />
                  <div className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <StockLabel
                        stockName={stock.stock_name}
                        stockCode={stock.stock_code}
                        className="font-medium text-[var(--accent)]"
                      />
                      <AssetClassTag stockName={stock.stock_name} stockCode={stock.stock_code} />
                    </span>
                    <span className="text-xs text-[var(--muted)]">{stock.stock_code}</span>
                  </div>
                </Link>
              </td>
              <td className="popular-stocks-table__etf-count">
                <span className="font-semibold tabular-nums">{stock.etf_count}</span>
              </td>
              <td>{formatNumber(stock.avg_weight, 2)}%</td>
              <td>{formatNumber(stock.max_weight, 2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
