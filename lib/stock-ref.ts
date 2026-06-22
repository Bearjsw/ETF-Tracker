/** Stable key for code+name pairs (KRX reuses 6-digit codes across unrelated names). */
export type StockRef = {
  stock_code: string;
  stock_name?: string | null;
};

export function stockRefKey(ref: StockRef): string {
  const code = ref.stock_code.trim();
  const name = ref.stock_name?.trim();
  if (!name) return code;
  return `${code}\u001f${name.toUpperCase()}`;
}

export function dedupeStockRefs(refs: StockRef[]): StockRef[] {
  const seen = new Set<string>();
  const out: StockRef[] = [];
  for (const ref of refs) {
    const key = stockRefKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}
