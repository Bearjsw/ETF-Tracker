import logoBrandData from "@/data/logo-brand-colors.json";
import { resolveDomesticCodeLogo, resolveKoreanNameLogo } from "@/lib/stock-logo-index";

/** Known brand colors for major holdings (overseas tickers, common codes). */
const STOCK_BRAND_COLORS: Record<string, string> = {
  "005930": "#1428A0",
  "000660": "#EA002C",
  "035420": "#03C75A",
  "035720": "#FEE500",
  "051910": "#004B98",
  "006400": "#0064FF",
  "005380": "#002C5F",
  "000270": "#05141F",
  "068270": "#009639",
  "105560": "#FF6600",
  "055550": "#0046FF",
  "032830": "#009490",
  "207940": "#009639",
  "373220": "#A50034",
  "028260": "#E30613",
  AAPL: "#555555",
  MSFT: "#0078D4",
  NVDA: "#76B900",
  AMZN: "#FF9900",
  GOOGL: "#4285F4",
  TSLA: "#CC0000",
};

const LOGO_BRAND_COLORS: Record<string, string> = logoBrandData.colors;

/** Wise design system–inspired chart palette (readable on white). */
export const WISE_CHART_COLORS = [
  "#163300",
  "#37517e",
  "#5d8a8a",
  "#6b8a5d",
  "#4a6741",
  "#8a6b5d",
  "#2d5a1e",
  "#5d6b5f",
  "#1e4d2b",
  "#7a9e6a",
];

const CHART_FALLBACK_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#ec4899",
  "#f97316",
  "#06b6d4",
  "#eab308",
  "#8b5cf6",
  "#64748b",
];

function isUsableBrandColor(color: string | null | undefined): color is string {
  if (!color || !/^#[0-9A-F]{6}$/i.test(color)) return false;
  const hex = color.slice(1);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.82;
}

function colorFromLogoStem(stem?: string | null): string | null {
  if (!stem) return null;
  const direct = LOGO_BRAND_COLORS[stem];
  if (isUsableBrandColor(direct)) return direct;

  for (const [logo, color] of Object.entries(LOGO_BRAND_COLORS)) {
    if (logo.length >= 3 && (stem.includes(logo) || logo.includes(stem))) {
      if (isUsableBrandColor(color)) return color;
    }
  }

  return null;
}

function colorFromName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const nameLogo = resolveKoreanNameLogo(trimmed);
  const fromLogo = colorFromLogoStem(nameLogo);
  if (fromLogo) return fromLogo;

  for (const [logo, color] of Object.entries(LOGO_BRAND_COLORS)) {
    if (logo.length >= 3 && trimmed.includes(logo)) {
      if (isUsableBrandColor(color)) return color;
    }
  }

  return null;
}

export function getStockChartColor(
  stockCode: string,
  stockName?: string | null,
  fallbackIndex = 0,
): string {
  const code = stockCode.trim();
  const codeBrand = STOCK_BRAND_COLORS[code];
  if (isUsableBrandColor(codeBrand)) return codeBrand;

  const logoStem = resolveDomesticCodeLogo(code);
  const fromCodeLogo = colorFromLogoStem(logoStem);
  if (fromCodeLogo) return fromCodeLogo;

  const fromName = colorFromName(stockName ?? "");
  if (fromName) return fromName;

  const key = code || stockName || "unknown";
  const hash = [...key].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return CHART_FALLBACK_COLORS[(hash + fallbackIndex) % CHART_FALLBACK_COLORS.length];
}
