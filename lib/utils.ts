export function formatNumber(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatKrw(value: number | null | undefined) {
  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) return "-";
  const abs = Math.abs(value);
  if (abs >= 1_0000_0000_0000) return `${formatNumber(value / 1_0000_0000_0000, 1)}조`;
  if (abs >= 1_0000_0000) return `${formatNumber(value / 1_0000_0000, 1)}억`;
  if (abs >= 1_0000) return `${formatNumber(value / 1_0000, 1)}만`;
  return `${formatNumber(value)}원`;
}

export function formatManagerShort(manager: string | null | undefined) {
  if (!manager) return "운용사 미상";
  return manager
    .replace(/^\(주\)\s*/g, "")
    .replace(/^주식회사\s*/g, "")
    .replace(/\s*\(주\)\s*$/g, "")
    .replace(/\s*주식회사\s*$/g, "")
    .trim();
}

const MANAGER_CHART_COLORS = ["#3b82f6", "#22c55e", "#ec4899", "#f97316", "#06b6d4", "#eab308", "#8b5cf6", "#64748b"];

export function managerChartColor(index: number) {
  return MANAGER_CHART_COLORS[index % MANAGER_CHART_COLORS.length];
}

export function formatShortDate(date: string) {
  const iso = normalizeIsoDate(date);
  if (!iso) return date;
  const parts = iso.split("-");
  return `${parts[1]}.${parts[2]}`;
}

/** DB·Date·ISO 문자열 → YYYY-MM-DD */
export function normalizeIsoDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const s = String(value).trim();

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dotted = s.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})/);
  if (dotted) {
    return `${dotted[1]}-${dotted[2].padStart(2, "0")}-${dotted[3].padStart(2, "0")}`;
  }

  const korean = s.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (korean) {
    return `${korean[1]}-${korean[2].padStart(2, "0")}-${korean[3].padStart(2, "0")}`;
  }

  return null;
}

/** 2026-06-13 → 2026년 6월 13일 */
export function formatListingDate(date: string | null | undefined) {
  const iso = normalizeIsoDate(date);
  if (!iso) return "—";
  const parts = iso.split("-");
  return `${parts[0]}년 ${Number(parts[1])}월 ${Number(parts[2])}일`;
}

/** 2026-06-13 → 6월 13일 */
export function formatDateHeading(date: string) {
  const iso = normalizeIsoDate(date);
  if (!iso) return date;
  const parts = iso.split("-");
  return `${Number(parts[1])}월 ${Number(parts[2])}일`;
}

/** 어제~4일 전은 상대 표기, 그 이전은 MM.DD */
export function formatRelativeChangeDate(dateStr: string, now = new Date()): string {
  const iso = normalizeIsoDate(dateStr);
  if (!iso) return dateStr;

  const parts = iso.split("-");
  const target = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);

  if (diffDays <= 0) return "오늘";
  if (diffDays === 1) return "어제";
  if (diffDays === 2) return "2일 전";
  if (diffDays === 3) return "3일 전";
  if (diffDays === 4) return "4일 전";
  return formatShortDate(iso);
}

export function formatStatsPeriod(stats: {
  latestDate?: string | null;
  earliestDate?: string | null;
  windowDays?: number;
}) {
  const days = stats.windowDays ?? 3;
  if (!stats.latestDate) return "데이터 수집 대기";
  if (stats.earliestDate && stats.earliestDate !== stats.latestDate) {
    return `최근 ${days}일 · ${stats.earliestDate}~${stats.latestDate}`;
  }
  return `최근 ${days}일 · ${stats.latestDate}`;
}

export function formatSignedKrw(value: number | null | undefined) {
  if (value == null || Number.isNaN(value) || value === 0) return null;
  const sign = value > 0 ? "+" : "−";
  return `${sign}${formatKrw(Math.abs(value))}`;
}

export function changeTypeLabel(type: string) {
  switch (type) {
    case "new":
      return "신규 편입";
    case "removed":
      return "제외";
    case "weight_up":
      return "비중 확대";
    case "weight_down":
      return "비중 축소";
    default:
      return type;
  }
}

export function changeTypeBadgeClass(type: string) {
  switch (type) {
    case "new":
      return "badge badge-new";
    case "weight_up":
      return "badge badge-weight-up";
    case "weight_down":
      return "badge badge-weight-down";
    case "removed":
      return "badge badge-removed";
    default:
      return "badge";
  }
}

/** 비중 확대·축소 등 변화 유형별 글자색 (트리맵·태그와 동일 톤) */
export function changeTypeDeltaClass(type: string, delta?: number | null) {
  if (type === "new" || type === "weight_up") return "delta-weight-up";
  if (type === "removed" || type === "weight_down") return "delta-weight-down";
  return (delta ?? 0) >= 0 ? "delta-positive" : "delta-negative";
}

export function strategyLabel(type: string) {
  switch (type) {
    case "active":
      return "액티브";
    case "theme":
      return "테마";
    default:
      return "패시브";
  }
}

export function formatPercent(value: number | null | undefined, digits = 2, showSign = false) {
  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) return "—";
  const sign = showSign && value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, digits)}%`;
}

export function formatDeltaPp(value: number | null | undefined, digits = 2) {
  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) return "—";
  if (Math.abs(value) < 0.005) return `0${digits > 0 ? `.${"0".repeat(digits)}` : ""}%p`;
  const sign = value > 0 ? "+" : "−";
  return `${sign}${formatNumber(Math.abs(value), digits)}%p`;
}

export function relativeWeightChange(
  prev: number | null | undefined,
  curr: number | null | undefined,
): number | null {
  if (prev == null || curr == null || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

export function isAccumulation(changeType: string, delta: number | null | undefined) {
  if (changeType === "new" || changeType === "weight_up") return true;
  if (changeType === "removed" || changeType === "weight_down") return false;
  return (delta ?? 0) >= 0;
}

export function signalTypeLabel(
  type: string,
  direction?: "accumulation" | "distribution",
) {
  switch (type) {
    case "new_entry":
      return "신규 편입";
    case "consensus":
      return direction === "distribution" ? "비중 축소" : "비중 확대";
    case "weight_surge":
      return "비중 급등";
    case "convergence":
      return "수렴";
    default:
      return type;
  }
}

export function strengthLabel(strength: string | null | undefined) {
  switch (strength) {
    case "high":
    case "strong":
      return "강함";
    case "medium":
    case "moderate":
      return "보통";
    case "low":
    case "weak":
      return "약함";
    default:
      return strength ?? "—";
  }
}
