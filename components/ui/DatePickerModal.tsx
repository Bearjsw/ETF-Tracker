"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn, formatDateHeading, normalizeIsoDate } from "@/lib/utils";

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

type Props = {
  open: boolean;
  onClose: () => void;
  value: string;
  onChange: (iso: string) => void;
  availableDates: string[];
  dateCounts?: Record<string, number>;
  title?: string;
};

function parseIsoParts(iso: string): { year: number; month: number; day: number } | null {
  const normalized = normalizeIsoDate(iso);
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  return { year, month, day };
}

function isoFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildMonthGrid(year: number, month: number): (number | null)[] {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startPad = (first.getDay() + 6) % 7;
  const cells: (number | null)[] = Array.from({ length: startPad }, () => null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  return cells;
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function DatePickerTrigger({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button type="button" className={cn("change-date-trigger", className)} onClick={onClick}>
      <CalendarIcon />
      {label}
    </button>
  );
}

export function DatePickerModal({
  open,
  onClose,
  value,
  onChange,
  availableDates,
  dateCounts = {},
  title = "기준일 선택",
}: Props) {
  const [mounted, setMounted] = useState(false);
  const availableSet = useMemo(() => new Set(availableDates.map((d) => normalizeIsoDate(d) ?? d)), [availableDates]);

  const initialParts = parseIsoParts(value) ?? parseIsoParts(availableDates[0] ?? "");
  const [viewYear, setViewYear] = useState(initialParts?.year ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(initialParts?.month ?? new Date().getMonth() + 1);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const parts = parseIsoParts(value);
    if (parts) {
      setViewYear(parts.year);
      setViewMonth(parts.month);
    }
  }, [open, value]);

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
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const monthBounds = useMemo(() => {
    if (!availableDates.length) return { minYear: viewYear, minMonth: viewMonth, maxYear: viewYear, maxMonth: viewMonth };
    const sorted = [...availableDates].sort();
    const min = parseIsoParts(sorted[0]!);
    const max = parseIsoParts(sorted[sorted.length - 1]!);
    return {
      minYear: min?.year ?? viewYear,
      minMonth: min?.month ?? viewMonth,
      maxYear: max?.year ?? viewYear,
      maxMonth: max?.month ?? viewMonth,
    };
  }, [availableDates, viewYear, viewMonth]);

  const canGoPrev = viewYear > monthBounds.minYear || (viewYear === monthBounds.minYear && viewMonth > monthBounds.minMonth);
  const canGoNext = viewYear < monthBounds.maxYear || (viewYear === monthBounds.maxYear && viewMonth < monthBounds.maxMonth);

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth - 1 + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth() + 1);
  };

  const modal =
    open && mounted
      ? createPortal(
          <div className="filter-modal-backdrop" role="presentation" onClick={onClose}>
            <div
              className="filter-modal date-picker-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="date-picker-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="filter-modal__header">
                <h2 id="date-picker-modal-title" className="filter-modal__title">
                  {title}
                </h2>
                <button type="button" className="filter-modal__close" onClick={onClose} aria-label="닫기">
                  ×
                </button>
              </div>

              <div className="filter-modal__body date-picker-modal__body">
                <div className="date-picker-calendar__nav">
                  <button
                    type="button"
                    className="date-picker-calendar__nav-btn"
                    disabled={!canGoPrev}
                    onClick={() => shiftMonth(-1)}
                    aria-label="이전 달"
                  >
                    ‹
                  </button>
                  <p className="date-picker-calendar__month">
                    {viewYear}년 {viewMonth}월
                  </p>
                  <button
                    type="button"
                    className="date-picker-calendar__nav-btn"
                    disabled={!canGoNext}
                    onClick={() => shiftMonth(1)}
                    aria-label="다음 달"
                  >
                    ›
                  </button>
                </div>

                <div className="date-picker-calendar__weekdays">
                  {WEEKDAYS.map((day) => (
                    <span key={day} className="date-picker-calendar__weekday">
                      {day}
                    </span>
                  ))}
                </div>

                <div className="date-picker-calendar__grid" role="grid">
                  {cells.map((day, i) => {
                    if (day == null) {
                      return <span key={`empty-${i}`} className="date-picker-calendar__cell" aria-hidden />;
                    }

                    const iso = isoFromParts(viewYear, viewMonth, day);
                    const available = availableSet.has(iso);
                    const selected = normalizeIsoDate(value) === iso;
                    const count = dateCounts[iso];

                    return (
                      <button
                        key={iso}
                        type="button"
                        role="gridcell"
                        disabled={!available}
                        className={cn(
                          "date-picker-calendar__day",
                          available && "date-picker-calendar__day--available",
                          selected && "date-picker-calendar__day--selected",
                        )}
                        onClick={() => {
                          onChange(iso);
                          onClose();
                        }}
                      >
                        <span>{day}</span>
                        {count != null && count > 0 ? (
                          <span className="date-picker-calendar__count">{count}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {value ? (
                  <p className="date-picker-modal__selected">
                    선택: {formatDateHeading(value)}
                    {dateCounts[value] != null ? ` · ${dateCounts[value]}건` : ""}
                  </p>
                ) : null}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return modal;
}
