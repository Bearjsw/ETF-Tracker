import Link from "next/link";
import type { NewListingItem } from "@/lib/types";
import { formatKrw, formatListingDate, formatManagerShort, normalizeIsoDate, strategyLabel } from "@/lib/utils";
import { EtfCategoryTag } from "@/components/explorer/EtfCategoryTag";

type Props = {
  items: NewListingItem[];
  days: number;
  compact?: boolean;
  /** 전체 건수 (페이지네이션 시 헤더용) */
  totalCount?: number;
};

export function NewListingsTable({ items, days, compact = false, totalCount }: Props) {
  if (!items.length) {
    return (
      <div className="card text-sm text-[var(--muted)]">
        최근 {days}일 내 상장된 액티브·테마 ETF가 없습니다.
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      {!compact ? (
        <div className="mb-3">
          <h2 className="section-title">신규상장 ETF</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            최근 {days}일 · {totalCount ?? items.length}종 · 액티브·테마
          </p>
        </div>
      ) : null}
      <table className="new-listings-table">
        <thead>
          <tr>
            <th>상장일</th>
            <th>ETF</th>
            <th>자산군</th>
            {!compact ? <th>유형</th> : null}
            <th>설정액</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const listingIso = normalizeIsoDate(item.listing_date);
            const listingLabel = formatListingDate(item.listing_date);
            return (
            <tr key={item.ticker}>
              <td className="new-listings-table__date">
                {listingIso ? (
                  <time dateTime={listingIso} lang="ko">
                    {listingLabel}
                  </time>
                ) : (
                  listingLabel
                )}
              </td>
              <td className="new-listings-table__name">
                <Link href={`/etfs/${item.ticker}`} className="font-semibold hover:text-[var(--accent)]">
                  {item.name}
                </Link>
                <div className="text-[11px] text-[var(--muted)]">{item.ticker}</div>
                {item.manager ? (
                  <div className="text-[11px] text-[var(--muted)]">{formatManagerShort(item.manager)}</div>
                ) : null}
              </td>
              <td>
                <EtfCategoryTag assetClass={item.asset_class} />
              </td>
              {!compact ? (
                <td>
                  <span className="badge">{strategyLabel(item.strategy_type)}</span>
                </td>
              ) : null}
              <td className="tabular-nums">{formatKrw(item.latest_aum)}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
