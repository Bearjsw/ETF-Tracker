"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { PopularStocksTable } from "@/components/explorer/PopularStocksTable";
import { Pagination } from "@/components/ui/Pagination";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TabBar } from "@/components/ui/TabBar";
import type { PopularStock } from "@/lib/types";
import {
  matchesStockFilters,
  normalizeCategoryForMarket,
  parseStockCategory,
  parseStockMarket,
  STOCK_MARKETS,
  visibleCategoryOptions,
  type StockCategoryFilter,
  type StockMarket,
} from "@/lib/stock-filters";

const PAGE_SIZE = 10;

type Props = {
  stocks: PopularStock[];
};

export function StocksExplorer({ stocks }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [page, setPage] = useState(1);

  const market = parseStockMarket(searchParams.get("market"));
  const category = normalizeCategoryForMarket(market, parseStockCategory(searchParams.get("category")));

  const categoryOptions = useMemo(() => visibleCategoryOptions(market, stocks), [market, stocks]);

  const update = useCallback(
    (patch: { market?: StockMarket | "all"; category?: StockCategoryFilter }) => {
      const params = new URLSearchParams(searchParams.toString());
      const nextMarket = patch.market ?? market;
      const nextCategory = patch.category ?? category;

      if (nextMarket === "all") params.delete("market");
      else params.set("market", nextMarket);

      const allowedCategories = visibleCategoryOptions(nextMarket, stocks).map((o) => o.value);
      const normalizedCategory = normalizeCategoryForMarket(
        nextMarket,
        allowedCategories.includes(nextCategory) ? nextCategory : "all",
      );

      if (normalizedCategory === "all") params.delete("category");
      else params.set("category", normalizedCategory);

      startTransition(() => {
        router.replace(`/stocks?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams, market, category, stocks],
  );

  const filtered = useMemo(
    () => stocks.filter((s) => matchesStockFilters(s.stock_name, s.stock_code, market, category)),
    [stocks, market, category],
  );

  const filterKey = useMemo(
    () =>
      `${market}:${category}:` +
      filtered
        .slice(0, 3)
        .map((s) => s.stock_code)
        .join("|") +
      `:${filtered.length}`,
    [market, category, filtered],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pageStocks = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const activeCategory = categoryOptions.some((o) => o.value === category) ? category : "all";

  return (
    <div className={`space-y-4 ${pending ? "opacity-70" : ""}`}>
      <TabBar
        items={STOCK_MARKETS.map((item) => ({ value: item.value, label: item.label }))}
        value={market}
        onChange={(value) => update({ market: value, category: "all" })}
        variant="stretch"
        size="sm"
        ariaLabel="국내·해외 구분"
      />

      <SegmentedControl
        items={categoryOptions}
        value={activeCategory}
        onChange={(value) => update({ category: value as StockCategoryFilter })}
        className="segmented-control-full segmented-control-wrap"
        ariaLabel="자산 유형"
      />

      {filtered.length > PAGE_SIZE ? (
        <p className="text-xs tabular-nums text-[var(--muted)]">
          {filtered.length}종 · {safePage}/{totalPages}페이지
        </p>
      ) : null}

      <PopularStocksTable
        stocks={pageStocks}
        emptyMessage={
          stocks.length
            ? "선택한 조건에 맞는 종목이 없습니다. 다른 필터를 선택해 보세요."
            : undefined
        }
      />

      <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
