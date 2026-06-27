"use client";

import { useEffect, useMemo, useState } from "react";
import { ChangeFeed } from "@/components/explorer/ChangeFeed";
import { DatePickerModal, DatePickerTrigger } from "@/components/ui/DatePickerModal";
import { Pagination } from "@/components/ui/Pagination";
import type { HoldingDiffEnriched, StockPricePoint } from "@/lib/types";
import { formatRelativeChangeDate } from "@/lib/utils";

const PAGE_SIZE = 6;

type Props = {
  changes: HoldingDiffEnriched[];
  priceByStock?: Record<string, StockPricePoint[]>;
};

function uniqueDatesDesc(changes: HoldingDiffEnriched[]): string[] {
  return [...new Set(changes.map((c) => c.date))].sort((a, b) => b.localeCompare(a));
}

export function FlowsChangeFeedSection({ changes, priceByStock }: Props) {
  const dates = useMemo(() => uniqueDatesDesc(changes), [changes]);
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const activeDate = date && dates.includes(date) ? date : (dates[0] ?? "");

  const dateCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const change of changes) {
      counts[change.date] = (counts[change.date] ?? 0) + 1;
    }
    return counts;
  }, [changes]);

  const filtered = useMemo(() => changes.filter((c) => c.date === activeDate), [changes, activeDate]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [activeDate]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (!changes.length) {
    return (
      <ChangeFeed
        changes={[]}
        priceByStock={priceByStock}
        title="비중 변화 (주식)"
        layout="list"
      />
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="section-title">비중 변화 (주식)</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            날짜별 필터 · 페이지당 {PAGE_SIZE}건
          </p>
        </div>
        {filtered.length > 0 ? (
          <p className="text-xs tabular-nums text-[var(--muted)]">
            {filtered.length}건 · {safePage}/{totalPages}페이지
          </p>
        ) : null}
      </div>

      <DatePickerTrigger
        label={`기준일 ${formatRelativeChangeDate(activeDate)}${dateCounts[activeDate] ? ` (${dateCounts[activeDate]})` : ""}`}
        onClick={() => setCalendarOpen(true)}
      />

      <DatePickerModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        value={activeDate}
        onChange={setDate}
        availableDates={dates}
        dateCounts={dateCounts}
        title="비중 변화 기준일"
      />

      {filtered.length ? (
        <>
          <ChangeFeed changes={pageItems} priceByStock={priceByStock} layout="list" />
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </>
      ) : (
        <div className="card text-sm text-[var(--muted)]">선택한 날짜에 비중 변화가 없습니다.</div>
      )}
    </section>
  );
}
