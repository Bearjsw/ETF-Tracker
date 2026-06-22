"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { TabBar } from "@/components/ui/TabBar";
import { RETURN_PERIODS } from "@/lib/rankings";
import type { ReturnPeriod } from "@/lib/types";

type Props = {
  current: {
    period?: ReturnPeriod;
  };
  basePath?: string;
};

export function EtfPeriodTabs({ current, basePath = "/etfs" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = useCallback(
    (period: ReturnPeriod) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("period", period);
      startTransition(() => {
        router.replace(`${basePath}?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams, basePath],
  );

  const period = current.period ?? "3m";

  return (
    <div className={pending ? "opacity-70" : ""}>
      <TabBar
        items={RETURN_PERIODS.map((item) => ({
          value: item.value,
          label: `${item.label} 수익률`,
        }))}
        value={period}
        onChange={update}
        variant="stretch"
        size="sm"
        ariaLabel="수익률 비교 기간"
      />
    </div>
  );
}
