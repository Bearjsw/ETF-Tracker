/** US 티커 로고 파일명 변형 (PLTR.svg, PLTR.O.svg, ORCL_ORCL.svg 등) */
import { ASCII_LOGO_STEMS, hasAsciiLogoStem } from "@/lib/stock-logo-index";

/** public/logos/stock 에 실제 파일이 없는 거래소 접미사 */
const NON_LOCAL_EXCHANGE_SUFFIX = /\.(SS|SZ|HK|TW|T|SI|AX|L|PA|DE|SW|TO|KS|KQ)$/i;

/** 로컬 SVG가 있을 때만 티커 경로 후보를 생성 (404 연쇄 방지) */
export function canResolveTickerLogo(ticker: string): boolean {
  const upper = ticker.toUpperCase();
  if (ASCII_LOGO_STEMS.has(upper)) return true;
  if (NON_LOCAL_EXCHANGE_SUFFIX.test(upper)) return false;
  return hasAsciiLogoStem(upper);
}

export function expandTickerLogoPaths(ticker: string): string[] {
  if (!canResolveTickerLogo(ticker)) return [];
  const paths: string[] = [];
  const seen = new Set<string>();
  const upper = ticker.toUpperCase();

  const add = (stem: string) => {
    const key = stem.toUpperCase();
    if (seen.has(key)) return;
    seen.add(key);
    paths.push(`/logos/stock/${encodeURIComponent(stem)}.svg`);
  };

  add(ticker);
  add(`${ticker}_${ticker}`);
  for (const suffix of [".O", ".N", ".A", ".K"]) {
    add(`${ticker}${suffix}`);
    add(`${ticker}_${ticker}${suffix}`);
  }

  for (const stem of ASCII_LOGO_STEMS) {
    const base = stem.replace(/\.[A-Z]$/, "");
    if (base === upper || base === `${upper}_${upper}`) {
      add(stem);
    }
  }

  return paths;
}
