"use client";

import { useEffect, useMemo, useState } from "react";
import { SignalListTable } from "@/components/explorer/SignalListTable";
import { Pagination } from "@/components/ui/Pagination";
import type { EtfNameLookup, SignalDaily } from "@/lib/types";

const PAGE_SIZE = 10;

type Props = {
  signals: SignalDaily[];
  etfMap: EtfNameLookup;
};

export function SignalListSection({ signals, etfMap }: Props) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(signals.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pageSignals = useMemo(
    () => signals.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [signals, safePage],
  );

  const filterKey = useMemo(
    () =>
      signals
        .slice(0, 3)
        .map((s) => `${s.date}-${s.stock_code}`)
        .join("|") + `:${signals.length}`,
    [signals],
  );

  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="space-y-4">
      {signals.length > PAGE_SIZE ? (
        <p className="text-xs tabular-nums text-[var(--muted)]">
          {signals.length}건 · {safePage}/{totalPages}페이지
        </p>
      ) : null}
      <SignalListTable signals={pageSignals} etfMap={etfMap} />
      <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
