"use client";

import { useState } from "react";
import { Pagination } from "@/components/ui/Pagination";
import type { HoldingDiffEnriched } from "@/lib/types";
import { formatDateHeading, formatManagerShort } from "@/lib/utils";

type Props = {
  diffs: HoldingDiffEnriched[];
  /** @deprecated 날짜별 diff 기준으로 표시 — 하위 호환용 */
  signals?: unknown[];
  /** 페이지당 표시할 일수 */
  daysPerPage?: number;
};

const CATEGORIES = [
  { key: "new", label: "신규 확대", types: ["new"] as const },
  { key: "weight_up", label: "비중 확대", types: ["weight_up"] as const },
  { key: "weight_down", label: "비중 축소", types: ["weight_down", "removed"] as const },
] as const;

function groupDiffsByDate(diffs: HoldingDiffEnriched[]) {
  const byDate = new Map<string, HoldingDiffEnriched[]>();
  for (const diff of diffs) {
    const rows = byDate.get(diff.date) ?? [];
    rows.push(diff);
    byDate.set(diff.date, rows);
  }
  return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

function summarizeCategory(rows: HoldingDiffEnriched[], types: readonly string[]) {
  const matched = rows.filter((row) => types.includes(row.change_type));
  const managers = [
    ...new Set(
      matched
        .map((row) => formatManagerShort(row.manager))
        .filter((name) => name && name !== "운용사 미상"),
    ),
  ];
  return { count: matched.length, managers };
}

export function SignalHistoryList({ diffs, daysPerPage = 4 }: Props) {
  const sortedDates = groupDiffsByDate(diffs);
  const totalDays = sortedDates.length;
  const totalEvents = diffs.length;
  const totalPages = Math.max(1, Math.ceil(totalDays / daysPerPage));
  const [page, setPage] = useState(1);

  const start = (page - 1) * daysPerPage;
  const dayCards = sortedDates.slice(start, start + daysPerPage);

  if (!sortedDates.length) {
    return (
      <div className="card">
        <h2 className="section-title">시그널 이력</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">시그널 이력이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="card signal-history">
      <div className="signal-history-card__header">
        <div>
          <h2 className="section-title">시그널 이력</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            전체 {totalDays}일 · {totalEvents.toLocaleString("ko-KR")}건
          </p>
        </div>
      </div>

      <div className="signal-history-days">
        {dayCards.map(([date, rows]) => (
          <article key={date} className="signal-day-card">
            <header className="signal-day-card__header">
              <time dateTime={date}>{formatDateHeading(date)}</time>
            </header>
            <ul className="signal-day-card__sections">
              {CATEGORIES.map(({ key, label, types }) => {
                const { count, managers } = summarizeCategory(rows, types);
                return (
                  <li key={key} className={`signal-day-row signal-day-row--${key}`}>
                    <span className="signal-day-row__label">{label}</span>
                    <span className="signal-day-row__count">{count.toLocaleString("ko-KR")}건</span>
                    <span className="signal-day-row__managers">
                      {managers.length ? managers.join(", ") : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>

      {totalPages > 1 ? (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      ) : null}
    </div>
  );
}
