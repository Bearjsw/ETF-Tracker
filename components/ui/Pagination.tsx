"use client";

import { cn } from "@/lib/utils";

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
};

const WINDOW_SIZE = 5;

function pageRange(current: number, total: number): (number | "ellipsis")[] {
  if (total <= WINDOW_SIZE) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  let start: number;
  let end: number;

  if (current <= WINDOW_SIZE) {
    start = 1;
    end = WINDOW_SIZE;
  } else if (current >= total - (WINDOW_SIZE - 1)) {
    start = total - WINDOW_SIZE + 1;
    end = total;
  } else {
    start = current - (WINDOW_SIZE - 1);
    end = current;
  }

  const out: (number | "ellipsis")[] = [];
  if (start > 1) out.push("ellipsis");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total) out.push("ellipsis");
  return out;
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d={direction === "left" ? "M10 12L6 8L10 4" : "M6 4L10 8L6 12"}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Pagination({ page, totalPages, onPageChange, className }: Props) {
  if (totalPages <= 1) return null;

  const items = pageRange(page, totalPages);

  return (
    <nav className={cn("pagination", className)} aria-label="페이지">
      <button
        type="button"
        className="pagination__btn pagination__btn--icon"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="이전 페이지"
      >
        <ChevronIcon direction="left" />
      </button>

      {items.map((item, i) =>
        item === "ellipsis" ? (
          <span key={`e-${i}`} className="pagination__ellipsis" aria-hidden>
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            className={cn("pagination__page", item === page && "pagination__page--active")}
            aria-current={item === page ? "page" : undefined}
            onClick={() => onPageChange(item)}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        className="pagination__btn pagination__btn--icon"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="다음 페이지"
      >
        <ChevronIcon direction="right" />
      </button>
    </nav>
  );
}
