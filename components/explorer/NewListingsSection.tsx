"use client";

import { useEffect, useMemo, useState } from "react";
import { NewListingsTable } from "@/components/explorer/NewListingsTable";
import { Pagination } from "@/components/ui/Pagination";
import type { NewListingItem } from "@/lib/types";

const PAGE_SIZE = 8;

type Props = {
  items: NewListingItem[];
  days: number;
};

export function NewListingsSection({ items, days }: Props) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(
    () => items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [items, safePage],
  );

  const filterKey = useMemo(
    () =>
      items
        .slice(0, 3)
        .map((item) => item.ticker)
        .join("|") + `:${items.length}`,
    [items],
  );

  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="space-y-4">
      <NewListingsTable items={pageItems} days={days} totalCount={items.length} />
      <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
