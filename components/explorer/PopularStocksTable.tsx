import Link from "next/link";
import { AssetClassTag } from "@/components/explorer/AssetClassTag";
import { StockLabel } from "@/components/explorer/StockLabel";
import { StockLogo } from "@/components/explorer/Logo";
import { isListedEquity } from "@/lib/equity-classify";
import type { PopularStock } from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/utils";

type Props = {
  stocks: PopularStock[];
  emptyMessage?: string;
};

function StockNameCell({ stock }: { stock: PopularStock }) {
  const isEquity = isListedEquity(stock.stock_name, stock.stock_code);
  const ret = stock.price_return_pct;

  if (isEquity) {
    return (
      <div className="min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate font-medium text-[var(--accent)]">
            <StockLabel stockName={stock.stock_name} stockCode={stock.stock_code} />
          </span>
          {ret != null ? (
            <span
              className={`shrink-0 text-xs font-semibold tabular-nums ${ret >= 0 ? "delta-positive" : "delta-negative"}`}
            >
              {formatPercent(ret, 1, true)}
            </span>
          ) : (
            <span className="shrink-0 text-xs tabular-nums text-[var(--muted)]">—</span>
          )}
        </span>
        <span className="mt-0.5 block">
          <AssetClassTag stockName={stock.stock_name} stockCode={stock.stock_code} />
        </span>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <span className="block font-medium text-[var(--accent)]">
        <StockLabel stockName={stock.stock_name} stockCode={stock.stock_code} />
      </span>
      <span className="mt-0.5 block">
        <AssetClassTag stockName={stock.stock_name} stockCode={stock.stock_code} />
      </span>
    </div>
  );
}

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
                  <StockNameCell stock={stock} />
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
