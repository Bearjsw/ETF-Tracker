import { inferAssetClass, isOverseasEquityEtfName } from "@/lib/asset-class";
import { isBondLikeAsset, formatBondIssuerDisplayName } from "@/lib/bond-issuer";
import { isNonEquityInstrument } from "@/lib/equity-classify";
import { formatOverseasEquityEtfDisplay } from "@/lib/overseas-equity-display";
import { resolveBondDisplayName } from "@/lib/bond-display-name";
import {
  formatDomesticCommodityEtfDisplay,
  isDomesticCommodityEtfName,
} from "@/lib/domestic-etf-product";

export type StockDisplayInfo = {
  display: string;
  /** 툴팁·상세용 원문 (단순화된 경우에만) */
  tooltip?: string;
};

/** UI 종목명 — 채권·유동성은 단순화, 발행사 음역(NH·KB) 적용 */
export function resolveStockDisplay(
  stockName?: string | null,
  stockCode?: string | null,
): StockDisplayInfo {
  const name = stockName?.trim();
  const code = stockCode?.trim();

  if (!name) {
    return { display: code ?? "—" };
  }

  if (isOverseasEquityEtfName(name)) {
    const equity = formatOverseasEquityEtfDisplay(name);
    return {
      display: equity.display,
      tooltip: equity.simplified ? name : undefined,
    };
  }

  if (isDomesticCommodityEtfName(name)) {
    const commodity = formatDomesticCommodityEtfDisplay(name);
    return {
      display: commodity.display,
      tooltip: commodity.simplified ? name : undefined,
    };
  }

  if (isBondLikeAsset(name, code) || isNonEquityInstrument(name, code)) {
    const bond = resolveBondDisplayName(name, code);
    if (bond) {
      return {
        display: bond.display,
        tooltip: bond.simplified ? bond.original : undefined,
      };
    }
    return {
      display: formatBondIssuerDisplayName(name),
      tooltip: formatBondIssuerDisplayName(name) !== name ? name : undefined,
    };
  }

  return { display: name };
}

export function formatStockDisplayName(
  stockName?: string | null,
  stockCode?: string | null,
): string {
  return resolveStockDisplay(stockName, stockCode).display;
}

export function getStockDisplayTooltip(
  stockName?: string | null,
  stockCode?: string | null,
): string | undefined {
  return resolveStockDisplay(stockName, stockCode).tooltip;
}
