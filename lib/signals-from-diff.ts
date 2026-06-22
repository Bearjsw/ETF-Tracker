import type { HoldingDiff, SignalDaily, StrategyType } from "@/lib/types";
import { isTrackableStock } from "@/lib/stock-filter";

export type DiffWithStrategy = HoldingDiff & { strategy_type?: StrategyType | null };

const ACCUMULATION_TYPES = new Set<HoldingDiff["change_type"]>(["weight_up"]);
const DISTRIBUTION_TYPES = new Set<HoldingDiff["change_type"]>(["weight_down", "removed"]);

export function signalDailyKey(
  signal: Pick<SignalDaily, "date" | "stock_code" | "signal_type" | "window_days">,
): string {
  return `${signal.date}|${signal.stock_code}|${signal.signal_type}|${signal.window_days}`;
}

function directionForChangeType(type: HoldingDiff["change_type"]): SignalDaily["direction"] | null {
  if (ACCUMULATION_TYPES.has(type)) return "accumulation";
  if (DISTRIBUTION_TYPES.has(type)) return "distribution";
  return null;
}

function strengthFromEtfCount(count: number): string {
  if (count >= 3) return "high";
  if (count === 2) return "medium";
  return "weak";
}

/** 같은 날·같은 종목에 2개 이상 ETF가 같은 방향으로 움직인 diff → consensus 시그널 */
export function buildDiffConsensusSignals(
  diffs: DiffWithStrategy[],
  opts?: { activeThemeOnly?: boolean },
): SignalDaily[] {
  const activeThemeOnly = opts?.activeThemeOnly ?? true;
  const buckets = new Map<string, DiffWithStrategy[]>();

  for (const row of diffs) {
    if (!isTrackableStock(row.stock_code, row.stock_name)) continue;
    if (activeThemeOnly && row.strategy_type && !["active", "theme"].includes(row.strategy_type)) {
      continue;
    }

    const direction = directionForChangeType(row.change_type);
    if (!direction) continue;

    const bucketKey = `${row.date}|${row.stock_code}|${direction}`;
    const list = buckets.get(bucketKey) ?? [];
    list.push(row);
    buckets.set(bucketKey, list);
  }

  const signals: SignalDaily[] = [];
  for (const [bucketKey, rows] of buckets) {
    const etfTickers = [...new Set(rows.map((r) => r.etf_ticker))];
    if (etfTickers.length < 2) continue;

    const [date, stock_code, direction] = bucketKey.split("|") as [
      string,
      string,
      SignalDaily["direction"],
    ];
    const deltas = rows
      .map((r) => Math.abs(Number(r.weight_delta ?? 0)))
      .filter((value) => value > 0);
    const score =
      deltas.length > 0
        ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length
        : etfTickers.length;

    signals.push({
      date,
      stock_code,
      stock_name: rows.find((r) => r.stock_name)?.stock_name ?? stock_code,
      signal_type: "consensus",
      direction,
      window_days: 1,
      etf_count: etfTickers.length,
      etf_tickers: etfTickers,
      score,
      strength: strengthFromEtfCount(etfTickers.length),
    });
  }

  return signals;
}

export function mergeSignalsWithDiffConsensus(
  stored: SignalDaily[],
  fromDiff: SignalDaily[],
): SignalDaily[] {
  const seen = new Set(stored.map(signalDailyKey));
  const merged = [...stored];
  for (const signal of fromDiff) {
    if (seen.has(signalDailyKey(signal))) continue;
    seen.add(signalDailyKey(signal));
    merged.push(signal);
  }

  return merged.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      Number(b.score ?? 0) - Number(a.score ?? 0) ||
      b.stock_code.localeCompare(a.stock_code),
  );
}
