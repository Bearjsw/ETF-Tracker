import {
  etfAssetClassLabel,
  etfAssetClassTone,
  inferEtfAssetClass,
  type EtfAssetClassId,
} from "@/lib/etf-asset-class";
import { cn } from "@/lib/cn";

type Props = {
  etfName?: string | null;
  assetClass?: EtfAssetClassId;
  className?: string;
};

export function EtfCategoryTag({ etfName, assetClass, className }: Props) {
  const id = assetClass ?? inferEtfAssetClass(etfName);
  return (
    <span
      className={cn("etf-category-tag", etfAssetClassTone(id), className)}
      title={`ETF 자산군: ${etfAssetClassLabel(id)}`}
    >
      {etfAssetClassLabel(id)}
    </span>
  );
}
