import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatKrw(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "-";
  const abs = Math.abs(value);
  if (abs >= 1_0000_0000_0000) return `${formatNumber(value / 1_0000_0000_0000, 1)}조`;
  if (abs >= 1_0000_0000) return `${formatNumber(value / 1_0000_0000, 1)}억`;
  if (abs >= 1_0000) return `${formatNumber(value / 1_0000, 1)}만`;
  return `${formatNumber(value)}원`;
}

export function changeTypeLabel(type: string) {
  switch (type) {
    case "new":
      return "신규편입";
    case "removed":
      return "제외";
    case "weight_up":
      return "비중확대";
    case "weight_down":
      return "비중축소";
    default:
      return type;
  }
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
