import { isListedEquity } from "@/lib/equity-classify";
import { assetClassLabel, assetClassTone, inferAssetClass } from "@/lib/asset-class";
import { isDomesticBondEtfName, isPreservedSerialBondName } from "@/lib/bond-display-name";
import { inferStockMarket } from "@/lib/stock-ticker-resolve";
import { cn } from "@/lib/utils";

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
  if (isDomesticBondEtfName(stockName) || isPreservedSerialBondName(stockName)) return null;

  const assetClass = inferAssetClass(stockName, stockCode);
  if (assetClass) {
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
