"use client";

type Layout = "list" | "grid";

type Props = {
  value: Layout;
  onChange: (value: Layout) => void;
};

function ListLayoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 7h14M5 12h14M5 17h14" strokeLinecap="round" />
    </svg>
  );
}

function GridLayoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="4" y="5" width="7" height="6" rx="1.5" />
      <rect x="13" y="5" width="7" height="6" rx="1.5" />
      <rect x="4" y="13" width="7" height="6" rx="1.5" />
      <rect x="13" y="13" width="7" height="6" rx="1.5" />
    </svg>
  );
}

export function StockFlowLayoutToggle({ value, onChange }: Props) {
  return (
    <div className="layout-toggle" role="group" aria-label="보기 방식">
      <button
        type="button"
        className={`layout-toggle__btn ${value === "list" ? "layout-toggle__btn--active" : ""}`}
        onClick={() => onChange("list")}
        aria-label="목록 보기"
        aria-pressed={value === "list"}
      >
        <ListLayoutIcon />
      </button>
      <button
        type="button"
        className={`layout-toggle__btn ${value === "grid" ? "layout-toggle__btn--active" : ""}`}
        onClick={() => onChange("grid")}
        aria-label="2열 그리드 보기"
        aria-pressed={value === "grid"}
      >
        <GridLayoutIcon />
      </button>
    </div>
  );
}
