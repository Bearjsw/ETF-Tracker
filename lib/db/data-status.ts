import { getSql } from "@/lib/db/client";
import { isDatabaseConfigured } from "@/lib/db/env";

function toIsoDate(value: unknown): string {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

// 시드 샘플(demo-data)은 소수의 ETF만 사용한다. 실제 수집 데이터는 수백 개이므로
// 보유 스냅샷의 고유 ETF 수로 샘플 여부를 판단한다. (웹 런타임의 KRX 자격증명과 무관)
const SAMPLE_ETF_THRESHOLD = 10;

export async function shouldShowSampleBanner(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT COUNT(DISTINCT etf_ticker)::int AS c FROM holdings_daily
    `) as { c: number }[];

    const distinctEtfs = rows[0]?.c ?? 0;
    // 데이터가 아예 없으면(0) 각 페이지의 빈 상태 안내가 처리하므로 배너는 숨긴다.
    return distinctEtfs > 0 && distinctEtfs <= SAMPLE_ETF_THRESHOLD;
  } catch {
    return false;
  }
}
