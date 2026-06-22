"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { FilterButtonGroup, FilterIcon, FilterSection } from "@/components/explorer/FilterControls";
import { formatManagerDisplay } from "@/lib/managers";
import {
  normalizeCategoryForMarket,
  parseStockCategory,
  parseStockMarket,
  STOCK_MARKETS,
  visibleCategoryOptions,
  type StockCategoryFilter,
  type StockMarket,
} from "@/lib/stock-filters";

type Props = {
  managers: string[];
  signals: { stock_name?: string | null; stock_code: string }[];
  current: {
    manager?: string;
    direction?: string;
    window?: string;
    q?: string;
    market?: string;
    category?: string;
  };
};

type DraftFilters = {
  manager: string;
  market: StockMarket | "all";
  category: StockCategoryFilter;
  direction: string;
  window: string;
};

const DIRECTIONS = [
  { value: "all", label: "전체" },
  { value: "accumulation", label: "▲ 매집" },
  { value: "distribution", label: "▼ 축소" },
];

const WINDOWS = [
  { value: "", label: "전체" },
  { value: "5", label: "5일" },
  { value: "10", label: "10일" },
  { value: "20", label: "20일" },
];

function readDraft(current: Props["current"]): DraftFilters {
  const market = parseStockMarket(current.market);
  return {
    manager: current.manager ?? "",
    market,
    category: normalizeCategoryForMarket(market, parseStockCategory(current.category)),
    direction: current.direction ?? "all",
    window: current.window ?? "",
  };
}

function countActiveFilters(current: Props["current"]): number {
  let n = 0;
  if (current.manager) n += 1;
  if (current.market && current.market !== "all") n += 1;
  if (current.category && current.category !== "all") n += 1;
  if (current.direction && current.direction !== "all") n += 1;
  if (current.window) n += 1;
  return n;
}

export function SignalFilters({ managers, signals, current }: Props) {
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
    () => visibleCategoryOptions(draft.market, signals),
    [draft.market, signals],
  );

  const activeCategory = categoryOptions.some((o) => o.value === draft.category)
    ? draft.category
    : "all";

  const managerOptions = useMemo(
    () => [
      { value: "", label: "전체" },
      ...managers.map((m) => ({ value: m, label: formatManagerDisplay(m) })),
    ],
    [managers],
  );

  const activeFilterCount = countActiveFilters(current);

  const pushParams = useCallback(
    (params: URLSearchParams) => {
      startTransition(() => {
        router.push(`/signals?${params.toString()}`);
      });
    },
    [router],
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

    if (draft.direction && draft.direction !== "all") params.set("direction", draft.direction);
    else params.delete("direction");

    if (draft.window) params.set("window", draft.window);
    else params.delete("window");

    if (draft.market && draft.market !== "all") params.set("market", draft.market);
    else params.delete("market");

    if (draft.category && draft.category !== "all") params.set("category", draft.category);
    else params.delete("category");

    pushParams(params);
    setOpen(false);
  }, [draft, searchParams, pushParams]);

  const resetDraft = useCallback(() => {
    setDraft({
      manager: "",
      market: "all",
      category: "all",
      direction: "all",
      window: "",
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
              aria-labelledby="signal-filter-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="filter-modal__header">
                <h2 id="signal-filter-modal-title" className="filter-modal__title">
                  시그널 필터
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
                      setDraft((d) => ({ ...d, category: value as StockCategoryFilter }))
                    }
                    ariaLabel="자산 유형"
                  />
                </FilterSection>

                <FilterSection label="시그널 방향">
                  <FilterButtonGroup
                    items={DIRECTIONS}
                    value={draft.direction}
                    onChange={(value) => setDraft((d) => ({ ...d, direction: value }))}
                    ariaLabel="시그널 방향"
                  />
                </FilterSection>

                <FilterSection label="조회 기간">
                  <FilterButtonGroup
                    items={WINDOWS}
                    value={draft.window}
                    onChange={(value) => setDraft((d) => ({ ...d, window: value }))}
                    ariaLabel="조회 기간"
                  />
                </FilterSection>
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
          <button type="button" className="btn-primary signal-filter-bar__search-btn" onClick={applySearch}>
            검색
          </button>
        </div>
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

      {modal}
    </>
  );
}
