import { isListedEquity } from "@/lib/equity-classify";
import { assetClassLabel, assetClassTone, inferAssetClass } from "@/lib/asset-class";
import { isDomesticBondEtfName, shouldPreserveBondDisplayName } from "@/lib/bond-display-name";
import { formatStockDisplayName } from "@/lib/stock-display";
import { inferStockMarket } from "@/lib/stock-ticker-resolve";
import { cn } from "@/lib/cn";

type Props = {
  stockName?: string | null;
  stockCode?: string | null;
  className?: string;
};

function equityMarketLabel(market: "domestic" | "overseas"): string {
  return market === "overseas" ? "해외주식" : "국내주식";
}

function equityMarketTone(market: "domestic" | "overseas"): string {
  return market === "overseas" ? "asset-class-tag--equity-overseas" : "asset-class-tag--equity-domestic";
}

export function AssetClassTag({ stockName, stockCode, className }: Props) {
  if (isDomesticBondEtfName(stockName)) return null;

  const assetClass = inferAssetClass(stockName, stockCode);
  if (assetClass) {
    if (shouldPreserveBondDisplayName(stockName)) return null;
    const display = formatStockDisplayName(stockName, stockCode);
    if (assetClass === "gov_bond" && (display === "국고채" || display === assetClassLabel(assetClass))) {
      return null;
    }
    return (
      <span
        className={cn("asset-class-tag", assetClassTone(assetClass), className)}
        title={`자산 유형: ${assetClassLabel(assetClass)}`}
      >
        {assetClassLabel(assetClass)}
      </span>
    );
  }

  if (isListedEquity(stockName, stockCode)) {
    const market = inferStockMarket(stockName, stockCode, null);
    if (market === "domestic" || market === "overseas") {
      return (
        <span
          className={cn("asset-class-tag", equityMarketTone(market), className)}
          title={`자산 유형: ${equityMarketLabel(market)}`}
        >
          {equityMarketLabel(market)}
        </span>
      );
    }
  }

  return null;
}
