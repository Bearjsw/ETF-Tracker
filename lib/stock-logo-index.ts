import domesticData from "@/data/domestic_code_logos.json";
import stemsData from "@/data/stock_logo_stems.json";

/** KRX 6자리 코드 → public/logos/stock 하위 파일 stem (확장자 제외) */
export const DOMESTIC_CODE_LOGOS: Record<string, string> = domesticData.codes;

export const DOMESTIC_NAME_ALIASES: Record<string, string> =
  "name_aliases" in domesticData
    ? (domesticData as { name_aliases: Record<string, string> }).name_aliases
    : {};

export const ASCII_LOGO_STEMS = new Set<string>(stemsData.ascii);
export const KOREAN_LOGO_NAMES = new Set<string>(stemsData.korean);
export const DOMESTIC_ASCII_LOGO_NAMES = new Set<string>(
  "domestic_ascii" in stemsData ? (stemsData as { domestic_ascii: string[] }).domestic_ascii : [],
);

function normalizeLogoLabel(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/&AMP;/gi, "&")
    .replace(/\s+/g, " ")
    .replace(/\.$/, "");
}

export function hasAsciiLogoStem(ticker: string): boolean {
  const upper = ticker.toUpperCase();
  if (ASCII_LOGO_STEMS.has(upper)) return true;
  for (const suffix of [".O", ".N", ".A", ".K"]) {
    if (ASCII_LOGO_STEMS.has(`${upper}${suffix}`)) return true;
  }
  return false;
}

export function resolveDomesticCodeLogo(stockCode?: string | null): string | null {
  const code = (stockCode ?? "").trim().padStart(6, "0");
  if (!/^\d{6}$/.test(code)) return null;
  return DOMESTIC_CODE_LOGOS[code] ?? null;
}

export function resolveKoreanNameLogo(stockName?: string | null): string | null {
  const name = stockName?.trim();
  if (!name) return null;

  const alias = DOMESTIC_NAME_ALIASES[name];
  if (alias) return alias;

  if (KOREAN_LOGO_NAMES.has(name)) return name;
  for (const logo of KOREAN_LOGO_NAMES) {
    if (logo.length >= 3 && (name.includes(logo) || logo.includes(name))) return logo;
  }

  return resolveDomesticAsciiNameLogo(name);
}

export function resolveDomesticAsciiNameLogo(stockName?: string | null): string | null {
  const name = stockName?.trim();
  if (!name) return null;

  const norm = normalizeLogoLabel(name);
  for (const logo of DOMESTIC_ASCII_LOGO_NAMES) {
    const logoNorm = normalizeLogoLabel(logo.replace(/&amp;/gi, "&"));
    if (logoNorm === norm) return logo;
  }

  for (const logo of DOMESTIC_ASCII_LOGO_NAMES) {
    if (logo.length >= 4 && (logo.toUpperCase().includes(name.toUpperCase()) || name.toUpperCase().includes(logo.toUpperCase()))) {
      return logo;
    }
  }

  return null;
}
