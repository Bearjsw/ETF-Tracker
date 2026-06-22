import type { EtfNavPoint } from "@/lib/types";
import { computePeriodReturn } from "@/lib/rankings";

/** Drop weekend rows and large single-day jumps from mixed legacy NAV seeds. */
export function sanitizeNavSeries(points: EtfNavPoint[]): EtfNavPoint[] {
  if (points.length < 2) return points;

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const weekdays = sorted.filter((p) => {
    const day = new Date(`${p.date}T12:00:00`).getDay();
    return day !== 0 && day !== 6;
  });

  const base = weekdays.length >= 2 ? weekdays : sorted;
  const cleaned: EtfNavPoint[] = [base[0]];

  for (let i = 1; i < base.length; i += 1) {
    const prev = cleaned[cleaned.length - 1];
    const curr = base[i];
    const change = Math.abs(curr.nav - prev.nav) / prev.nav;
    if (change <= 0.12) {
      cleaned.push(curr);
    }
  }

  return cleaned.length >= 2 ? cleaned : sorted;
}

function isoDateDaysBefore(endIso: string, days: number): string {
  const [year, month, day] = endIso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function trimNavSeriesToDays(points: EtfNavPoint[], periodDays: number): EtfNavPoint[] {
  const series = sanitizeNavSeries(points);
  if (series.length < 2 || periodDays <= 0) return series;
  if (periodDays >= 9999) return series;

  const latest = series[series.length - 1].date;
  const startStr = isoDateDaysBefore(latest, periodDays);
  const trimmed = series.filter((p) => p.date >= startStr);
  return trimmed.length >= 2 ? trimmed : series;
}

export function navSeriesPerf(points: EtfNavPoint[], periodDays?: number): number | null {
  const series = sanitizeNavSeries(points);
  if (series.length < 2) return null;

  if (periodDays != null) {
    return computePeriodReturn(
      series.map((p) => ({ date: p.date, value: p.nav })),
      periodDays,
    );
  }

  const first = series[0].nav;
  const last = series[series.length - 1].nav;
  if (!first) return null;
  return ((last - first) / first) * 100;
}
