import { formatStockDisplayName, getStockDisplayTooltip } from "@/lib/stock-display";

type Props = {
  stockName?: string | null;
  stockCode: string;
  className?: string;
};

export function StockLabel({ stockName, stockCode, className }: Props) {
  const display = formatStockDisplayName(stockName, stockCode);
  const tooltip = getStockDisplayTooltip(stockName, stockCode);

  return (
    <span className={className} title={tooltip}>
      {display}
    </span>
  );
}
