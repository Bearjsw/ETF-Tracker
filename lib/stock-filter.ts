/** Exclude cash / placeholder rows from stock rankings and signals. */

import { isListedEquity } from "@/lib/equity-classify";

const CASH_NAME_PATTERN = /설정현금|현금및|예금|CASH|머니마켓|MMF|원화현금|원화$/i;

export function isTrackableStock(
  stockCode: string | null | undefined,
  stockName?: string | null,
): boolean {
  const code = (stockCode ?? "").trim();
  if (!/^[0-9]{6}$/.test(code)) return false;
  if (code === "000000") return false;

  const name = (stockName ?? "").trim();
  if (name && CASH_NAME_PATTERN.test(name)) return false;

  return true;
}

/** 주식(국내·해외)만 — 채권·CP·TRS·스왑·ETF·선물 등 차트 없는 자산 제외 */
export function isEquityStock(
  stockCode: string | null | undefined,
  stockName?: string | null,
): boolean {
  return isListedEquity(stockName, stockCode, "all");
}
