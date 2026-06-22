"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { FilterButtonGroup, FilterSection } from "@/components/explorer/FilterControls";
import {
  ETF_ASSET_CLASS_LABELS,
  ETF_ASSET_CLASS_ORDER,
  parseListingCategoryFilter,
  type EtfAssetClassId,
} from "@/lib/etf-asset-class";

type CategoryFilter = EtfAssetClassId | "all";

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "전체" },
  ...ETF_ASSET_CLASS_ORDER.map((id) => ({
    value: id,
    label: ETF_ASSET_CLASS_LABELS[id],
  })),
];

type Props = {
  current?: { category?: string };
};

export function NewListingsFilter({ current }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const category = parseListingCategoryFilter(current?.category);

  const onChange = useCallback(
    (value: CategoryFilter) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all") params.delete("category");
      else params.set("category", value);
      startTransition(() => {
        router.push(`/market?${params.toString()}#listings`);
      });
    },
    [router, searchParams],
  );

  return (
    <div className={`card ${pending ? "opacity-70" : ""}`}>
      <FilterSection label="자산군">
        <FilterButtonGroup
          items={CATEGORY_OPTIONS}
          value={category}
          onChange={onChange}
          ariaLabel="신규상장 ETF 자산군 필터"
        />
      </FilterSection>
    </div>
  );
}
