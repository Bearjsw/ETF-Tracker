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

export async function shouldShowSampleBanner(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT COUNT(*)::int AS c FROM holdings_daily WHERE date >= CURRENT_DATE - INTERVAL '3 days'
    `) as { c: number }[];

    const hasKrx = Boolean(process.env.KRX_ID?.trim() && process.env.KRX_PW?.trim());
    return (rows[0]?.c ?? 0) > 0 && !hasKrx;
  } catch {
    return false;
  }
}
