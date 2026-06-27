"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { FilterButtonGroup, FilterIcon, FilterSection } from "@/components/explorer/FilterControls";
import { EquityBoardFilter } from "@/components/explorer/EquityBoardFilter";
import { formatManagerDisplay } from "@/lib/managers";
import {
  normalizeBoardForMarket,
  normalizeCategoryForMarket,
  parseStockBoard,
  parseStockCategory,
  parseStockMarket,
  showEquityBoardFilter,
  STOCK_MARKETS,
  visibleCategoryOptions,
  visibleEquityBoardOptions,
  type StockBoardFilter,
  type StockCategoryFilter,
  type StockMarket,
} from "@/lib/stock-filters";

type Props = {
  managers: string[];
  stocks: { stock_name?: string | null; stock_code: string }[];
  current: {
    manager?: string;
    sort?: string;
    period?: string;
    market?: string;
    category?: string;
    board?: string;
    q?: string;
  };
  basePath?: string;
};

type DraftFilters = {
  manager: string;
  market: StockMarket | "all";
  category: StockCategoryFilter;
  board: StockBoardFilter;
};

function readDraft(current: Props["current"]): DraftFilters {
  const market = parseStockMarket(current.market);
  const category = normalizeCategoryForMarket(market, parseStockCategory(current.category));
  return {
    manager: current.manager ?? "",
    market,
    category,
    board: normalizeBoardForMarket(market, category, parseStockBoard(current.board)),
  };
}

function countActiveFilters(current: Props["current"]): number {
  let n = 0;
  if (current.manager) n += 1;
  if (current.market && current.market !== "all") n += 1;
  if (current.category && current.category !== "all") n += 1;
  if (current.board && current.board !== "all") n += 1;
  return n;
}

export function StockFlowFilters({ managers, stocks, current, basePath = "/flows" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState(current.q ?? "");
  const [draft, setDraft] = useState<DraftFilters>(() => readDraft(current));

  useEffect(() => {
    setQuery(current.q ?? "");
  }, [current.q]);

  const categoryOptions = useMemo(
    () => visibleCategoryOptions(draft.market, stocks),
    [draft.market, stocks],
  );

  const boardOptions = useMemo(
    () => visibleEquityBoardOptions(draft.market, draft.category, stocks),
    [draft.market, draft.category, stocks],
  );

  const activeCategory = categoryOptions.some((o) => o.value === draft.category)
    ? draft.category
    : "all";

  const activeBoard = boardOptions.some((o) => o.value === draft.board) ? draft.board : "all";

  const managerOptions = useMemo(
    () => [
      { value: "", label: "전체" },
      ...managers.map((m) => ({ value: m, label: formatManagerDisplay(m) })),
    ],
    [managers],
  );

  const activeFilterCount = countActiveFilters(current);

  const appliedMarket = parseStockMarket(current.market);
  const appliedCategory = normalizeCategoryForMarket(
    appliedMarket,
    parseStockCategory(current.category),
  );
  const appliedBoard = normalizeBoardForMarket(
    appliedMarket,
    appliedCategory,
    parseStockBoard(current.board),
  );

  const pushParams = useCallback(
    (params: URLSearchParams) => {
      startTransition(() => {
        router.push(`${basePath}?${params.toString()}`);
      });
    },
    [router, basePath],
  );

  const applySearch = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = query.trim();
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    pushParams(params);
  }, [searchParams, query, pushParams]);

  const openModal = useCallback(() => {
    setDraft(readDraft(current));
    setOpen(true);
  }, [current]);

  const closeModal = useCallback(() => setOpen(false), []);

  const applyDraft = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (draft.manager) params.set("manager", draft.manager);
    else params.delete("manager");

    if (draft.market && draft.market !== "all") params.set("market", draft.market);
    else params.delete("market");

    if (draft.category && draft.category !== "all") params.set("category", draft.category);
    else params.delete("category");

    const normalizedBoard = normalizeBoardForMarket(draft.market, draft.category, draft.board);
    if (normalizedBoard !== "all") params.set("board", normalizedBoard);
    else params.delete("board");

    pushParams(params);
    setOpen(false);
  }, [draft, searchParams, pushParams]);

  const resetDraft = useCallback(() => {
    setDraft({
      manager: "",
      market: "all",
      category: "all",
      board: "all",
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeModal]);

  const modal =
    open && mounted
      ? createPortal(
          <div className="filter-modal-backdrop" role="presentation" onClick={closeModal}>
            <div
              className="filter-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="stock-flow-filter-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="filter-modal__header">
                <h2 id="stock-flow-filter-modal-title" className="filter-modal__title">
                  종목 필터
                </h2>
                <button type="button" className="filter-modal__close" onClick={closeModal} aria-label="닫기">
                  ×
                </button>
              </div>

              <div className="filter-modal__body">
                <FilterSection label="운용사">
                  <FilterButtonGroup
                    items={managerOptions}
                    value={draft.manager}
                    onChange={(value) => setDraft((d) => ({ ...d, manager: value }))}
                    ariaLabel="운용사"
                  />
                </FilterSection>

                <FilterSection label="시장">
                  <FilterButtonGroup
                    items={STOCK_MARKETS.map((item) => ({ value: item.value, label: item.label }))}
                    value={draft.market}
                    onChange={(value) =>
                      setDraft((d) => ({
                        ...d,
                        market: value,
                        category: "all",
                        board: "all",
                      }))
                    }
                    ariaLabel="시장"
                  />
                </FilterSection>

                <FilterSection label="자산 유형">
                  <FilterButtonGroup
                    items={categoryOptions}
                    value={activeCategory}
                    onChange={(value) =>
                      setDraft((d) => ({
                        ...d,
                        category: value as StockCategoryFilter,
                        board: "all",
                      }))
                    }
                    ariaLabel="자산 유형"
                  />
                </FilterSection>

                {showEquityBoardFilter(draft.market, draft.category) && boardOptions.length > 1 ? (
                  <FilterSection label={draft.market === "domestic" ? "주식 시장" : "거래소"}>
                    <FilterButtonGroup
                      items={boardOptions}
                      value={activeBoard}
                      onChange={(value) =>
                        setDraft((d) => ({ ...d, board: value as StockBoardFilter }))
                      }
                      ariaLabel={draft.market === "domestic" ? "주식 시장" : "거래소"}
                    />
                  </FilterSection>
                ) : null}
              </div>

              <div className="filter-modal__footer">
                <button type="button" className="btn-ghost text-sm" onClick={resetDraft}>
                  초기화
                </button>
                <div className="filter-modal__footer-actions">
                  <button type="button" className="btn-ghost text-sm" onClick={closeModal}>
                    취소
                  </button>
                  <button type="button" className="btn-primary text-sm" onClick={applyDraft}>
                    적용
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className={`signal-filter-bar ${pending ? "opacity-70" : ""}`}>
        <div className="signal-filter-bar__search">
          <input
            type="search"
            value={query}
            placeholder="종목명 또는 코드"
            className="filter-search-input signal-filter-bar__input"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applySearch();
            }}
          />
        </div>
        <div className="signal-filter-bar__actions">
          <button type="button" className="btn-primary signal-filter-bar__search-btn" onClick={applySearch}>
            검색
          </button>
          <button
            type="button"
            className="btn-ghost signal-filter-bar__filter-btn"
            onClick={openModal}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={activeFilterCount > 0 ? `필터 (${activeFilterCount}개 적용)` : "필터"}
          >
            <FilterIcon />
            {activeFilterCount > 0 ? (
              <span className="signal-filter-bar__badge">{activeFilterCount}</span>
            ) : null}
          </button>
        </div>
      </div>

      {showEquityBoardFilter(appliedMarket, appliedCategory) ? (
        <EquityBoardFilter
          market={appliedMarket}
          category={appliedCategory}
          board={appliedBoard}
          stocks={stocks}
          onChange={(value) => {
            const params = new URLSearchParams(searchParams.toString());
            if (value === "all") params.delete("board");
            else params.set("board", value);
            pushParams(params);
          }}
          className="segmented-control-full segmented-control-wrap"
        />
      ) : null}

      {modal}
    </>
  );
}
