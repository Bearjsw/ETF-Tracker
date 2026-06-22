import type { EtfAssetClassId } from "@/lib/etf-asset-class";

/** ETFScope / etf-category-tag 색상과 동일 */
export const FUND_FLOW_CLASS_COLORS: Record<EtfAssetClassId, string> = {
  equity: "#1d4ed8",
  bond: "#0e7490",
  leverage_inverse: "#be185d",
  allocation: "#6d28d9",
  commodity: "#b45309",
  alternative: "#4d7c0f",
  cash: "#15803d",
  currency: "#475569",
};
