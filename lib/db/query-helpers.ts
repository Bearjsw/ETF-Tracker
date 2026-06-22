type SqlClient = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

let latestDiffDateCache: { value: string | null; expires: number } | null = null;

export async function getLatestHoldingsDiffDate(sql: SqlClient): Promise<string | null> {
  const now = Date.now();
  if (latestDiffDateCache && latestDiffDateCache.expires > now) {
    return latestDiffDateCache.value;
  }

  const rows = (await sql`
    SELECT TO_CHAR(MAX(date), 'YYYY-MM-DD') AS d FROM holdings_diff
  `) as { d: string | null }[];

  const value = rows[0]?.d ? String(rows[0].d).slice(0, 10) : null;
  latestDiffDateCache = { value, expires: now + 30_000 };
  return value;
}

export function cutoffIsoDate(latestDate: string, lookbackDays: number): string {
  const [y, m, d] = latestDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - lookbackDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
