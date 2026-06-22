"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TabBar } from "@/components/ui/TabBar";
import { RETURN_PERIODS, STOCK_FLOW_SORTS } from "@/lib/rankings";
import type { ReturnPeriod, StockFlowSort } from "@/lib/types";

type Props = {
  current: {
    sort?: StockFlowSort;
    period?: ReturnPeriod;
    manager?: string;
  };
  basePath?: string;
};

export function StockFlowSortBar({ current, basePath = "/flows" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = useCallback(
    (patch: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (!value) params.delete(key);
        else params.set(key, value);
      }
      startTransition(() => {
        router.replace(`${basePath}?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams, basePath],
  );

  const sort = current.sort ?? "turnover";
  const period = current.period ?? "3m";

  return (
    <div className={`space-y-3 ${pending ? "opacity-70" : ""}`}>
      <TabBar
        items={STOCK_FLOW_SORTS.map((item) => ({ value: item.value, label: item.label }))}
        value={sort}
        onChange={(value) => update({ sort: value })}
        variant="stretch"
        ariaLabel="순위 기준"
      />
      <SegmentedControl
        items={RETURN_PERIODS.map((item) => ({
          value: item.value,
          label: `${item.label} 전`,
        }))}
        value={period}
        onChange={(value) => update({ period: value })}
        className="segmented-control-full"
        ariaLabel="집계 기간"
      />
    </div>
  );
}
