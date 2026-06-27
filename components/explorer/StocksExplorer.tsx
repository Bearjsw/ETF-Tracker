"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { PopularStocksTable } from "@/components/explorer/PopularStocksTable";
import { EquityBoardFilter } from "@/components/explorer/EquityBoardFilter";
import { Pagination } from "@/components/ui/Pagination";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TabBar } from "@/components/ui/TabBar";
import type { PopularStock } from "@/lib/types";
import { isListedEquity } from "@/lib/equity-classify";
import {
  matchesStockFilters,
  matchesStockQuery,
  normalizeBoardForMarket,
  normalizeCategoryForMarket,
  parseStockBoard,
  parseStockCategory,
  parseStockMarket,
  STOCK_MARKETS,
  visibleCategoryOptions,
  type StockBoardFilter,
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
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  const market = parseStockMarket(searchParams.get("market"));
  const category = normalizeCategoryForMarket(market, parseStockCategory(searchParams.get("category")));
  const board = normalizeBoardForMarket(market, category, parseStockBoard(searchParams.get("board")));
  const searchQuery = searchParams.get("q") ?? "";

  const categoryOptions = useMemo(() => visibleCategoryOptions(market, stocks), [market, stocks]);

  useEffect(() => {
    setQuery(searchQuery);
  }, [searchQuery]);

  const applySearch = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = query.trim();
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    startTransition(() => {
      router.replace(`/stocks?${params.toString()}`, { scroll: false });
    });
  }, [query, router, searchParams]);

  const update = useCallback(
    (patch: { market?: StockMarket | "all"; category?: StockCategoryFilter; board?: StockBoardFilter }) => {
      const params = new URLSearchParams(searchParams.toString());
      const nextMarket = patch.market ?? market;
      const nextCategory = patch.category ?? category;
      const nextBoard = patch.board ?? board;

      if (nextMarket === "all") params.delete("market");
      else params.set("market", nextMarket);

      const allowedCategories = visibleCategoryOptions(nextMarket, stocks).map((o) => o.value);
      const normalizedCategory = normalizeCategoryForMarket(
        nextMarket,
        allowedCategories.includes(nextCategory) ? nextCategory : "all",
      );

      if (normalizedCategory === "all") params.delete("category");
      else params.set("category", normalizedCategory);

      const normalizedBoard = normalizeBoardForMarket(nextMarket, normalizedCategory, nextBoard);
      if (normalizedBoard === "all") params.delete("board");
      else params.set("board", normalizedBoard);

      startTransition(() => {
        router.replace(`/stocks?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams, market, category, board, stocks],
  );

  const filtered = useMemo(
    () =>
      stocks.filter(
        (s) =>
          matchesStockFilters(s.stock_name, s.stock_code, market, category, board) &&
          matchesStockQuery(s.stock_name, s.stock_code, searchQuery),
      ),
    [stocks, market, category, board, searchQuery],
  );

  const filterKey = useMemo(
    () =>
      `${market}:${category}:${board}:${searchQuery}:` +
      filtered
        .slice(0, 3)
        .map((s) => s.stock_code)
        .join("|") +
      `:${filtered.length}`,
    [market, category, board, searchQuery, filtered],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pageStocks = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  const [displayStocks, setDisplayStocks] = useState(pageStocks);

  useEffect(() => {
    setDisplayStocks(pageStocks);
    const equities = pageStocks.filter((s) => isListedEquity(s.stock_name, s.stock_code));
    if (!equities.length) return;

    const controller = new AbortController();
    fetch("/api/stocks/returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stocks: equities }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: { stock_code: string; price_return_pct: number | null }[]) => {
        const byCode = new Map(rows.map((r) => [r.stock_code, r.price_return_pct]));
        setDisplayStocks(
          pageStocks.map((s) => ({
            ...s,
            price_return_pct: byCode.get(s.stock_code) ?? s.price_return_pct ?? null,
          })),
        );
      })
      .catch(() => {
        /* ignore — table still renders without returns */
      });

    return () => controller.abort();
  }, [pageStocks]);

  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const activeCategory = categoryOptions.some((o) => o.value === category) ? category : "all";

  return (
    <div className={`space-y-4 ${pending ? "opacity-70" : ""}`}>
      <div className="stocks-search-bar">
        <div className="stocks-search-bar__field">
          <input
            type="search"
            value={query}
            placeholder="종목명 또는 코드 검색"
            className="filter-search-input stocks-search-bar__input"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applySearch();
            }}
          />
        </div>
        <div className="stocks-search-bar__actions">
          <button type="button" className="btn-primary stocks-search-bar__btn" onClick={applySearch}>
            검색
          </button>
          {searchQuery ? (
            <button
              type="button"
              className="btn-ghost stocks-search-bar__btn"
              onClick={() => {
                setQuery("");
                const params = new URLSearchParams(searchParams.toString());
                params.delete("q");
                startTransition(() => {
                  router.replace(`/stocks?${params.toString()}`, { scroll: false });
                });
              }}
            >
              초기화
            </button>
          ) : null}
        </div>
      </div>

      <TabBar
        items={STOCK_MARKETS.map((item) => ({ value: item.value, label: item.label }))}
        value={market}
        onChange={(value) => update({ market: value, category: "all", board: "all" })}
        variant="stretch"
        size="sm"
        ariaLabel="국내·해외 구분"
      />

      <SegmentedControl
        items={categoryOptions}
        value={activeCategory}
        onChange={(value) => update({ category: value as StockCategoryFilter, board: "all" })}
        className="segmented-control-full segmented-control-wrap"
        ariaLabel="자산 유형"
      />

      <EquityBoardFilter
        market={market}
        category={activeCategory}
        board={board}
        stocks={stocks}
        onChange={(value) => update({ board: value })}
        className="segmented-control-full segmented-control-wrap"
      />

      {filtered.length > PAGE_SIZE || searchQuery ? (
        <p className="text-xs tabular-nums text-[var(--muted)]">
          {searchQuery ? `“${searchQuery}” ` : ""}
          {filtered.length}종
          {filtered.length > PAGE_SIZE ? ` · ${safePage}/${totalPages}페이지` : ""}
        </p>
      ) : null}

      <PopularStocksTable
        stocks={displayStocks}
        emptyMessage={
          stocks.length
            ? searchQuery
              ? `“${searchQuery}”에 맞는 종목이 없습니다.`
              : "선택한 조건에 맞는 종목이 없습니다. 다른 필터를 선택해 보세요."
            : undefined
        }
      />

      <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
