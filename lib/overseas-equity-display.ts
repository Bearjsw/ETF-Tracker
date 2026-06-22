const MAX_LABEL_LEN = 12;
/** 해외 주식 ETF — 운용사·지수 구분 */
const ETF_LABEL_LEN = 18;

function trimLabel(text: string, max = MAX_LABEL_LEN): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1)}…`;
}

const ISSUER_LABELS: Record<string, string> = {
  vanguard: "Vanguard",
  ishares: "iShares",
  invesco: "Invesco",
  wisdomtree: "WisdomTree",
  blackrock: "BlackRock",
  jpmorgan: "JPMorgan",
  proshares: "ProShares",
};

function extractOverseasEtfIssuer(name: string): string | null {
  if (/^State Street|^SS SPDR|^STE STR SPDR|^SPDR/i.test(name)) return "SPDR";
  const m = name.match(/^(Vanguard|iShares|Invesco|WisdomTree|BlackRock|JPMorgan|ProShares)\s+/i);
  if (!m) return null;
  return ISSUER_LABELS[m[1].toLowerCase()] ?? m[1];
}

function extractIndexTag(name: string): string | null {
  const upper = name.toUpperCase();
  if (/S&P\s*500/.test(upper)) return "S&P500";
  if (/FTSE\s*100/.test(upper)) return "FTSE100";
  if (/FTSE/.test(upper)) return "FTSE";
  if (/\bACWI\b/.test(upper)) return "ACWI";
  if (/MSCI\s*EAFE|\bEAFE\b/.test(upper)) return "MSCI";
  if (/MSCI/.test(upper)) return "MSCI";
  if (/NASDAQ/.test(upper)) return "나스닥";
  if (/RUSSELL\s*2000/.test(upper)) return "Russell";
  if (/NIKKEI/.test(upper)) return "닛케이";
  return null;
}

function buildEtfLabel(name: string, theme: string, index?: string | null): string {
  const issuer = extractOverseasEtfIssuer(name);
  const indexTag = index === undefined ? extractIndexTag(name) : index;
  const parts = [issuer, indexTag, theme].filter(Boolean) as string[];
  if (parts.length === 0) return trimLabel(theme, ETF_LABEL_LEN);
  return trimLabel(parts.join(" "), ETF_LABEL_LEN);
}

type ThemedRule = { pattern: RegExp; theme: string; index?: string | null };

/** 넓은 테마 — 운용사·지수 접두로 구분 */
const THEMED_ETF_RULES: ThemedRule[] = [
  { pattern: /VANGUARD.*S&P\s*500|S&P\s*500.*ETF|\bVOO\b|\bIVV\b|\bSPY\b/i, theme: "S&P500", index: null },
  { pattern: /TOTAL\s*WORLD.*STOCK|\bVT\b(?!.*BOND)/i, theme: "글로벌" },
  { pattern: /\bACWI\b/i, theme: "ACWI", index: null },
  { pattern: /NASDAQ|100.*ETF|\bQQQ\b/i, theme: "나스닥100" },
  { pattern: /MSCI.*EAFE|\bEAFE\b/i, theme: "선진국", index: "MSCI" },
  { pattern: /DEVELOPED.*MARKET|\bVEA\b/i, theme: "선진국" },
  { pattern: /EMERGING.*MARKET|\bEEM\b|\bVWO\b/i, theme: "신흥국" },
  { pattern: /SEMICONDUCTOR|\bSOXX\b|\bSMH\b/i, theme: "반도체" },
  { pattern: /TECHNOLOGY|\bXLK\b|\bVGT\b/i, theme: "기술주" },
  { pattern: /HEALTH|\bXLV\b|\bVHT\b/i, theme: "헬스케어" },
  { pattern: /DIVIDEND|\bVYM\b|\bSCHD\b/i, theme: "배당" },
  { pattern: /SMALL\s*CAP|\bVB\b|\bIWM\b/i, theme: "소형주" },
  { pattern: /RUSSELL\s*2000/i, theme: "러셀2000" },
  { pattern: /FTSE.*100/i, theme: "영국", index: "FTSE100" },
  { pattern: /NIKKEI|225/i, theme: "닛케이225" },
  { pattern: /GROWTH|\bVUG\b/i, theme: "성장주" },
  { pattern: /VALUE|\bVTV\b/i, theme: "가치주" },
];

/** Vanguard S&P 500 ETF → Vanguard S&P500, FTSE Emerging → Vanguard FTSE 신흥국 */
export function formatOverseasEquityEtfDisplay(name: string): {
  display: string;
  simplified: boolean;
} {
  const original = name.trim();
  const upper = original.toUpperCase();

  for (const { pattern, theme, index } of THEMED_ETF_RULES) {
    if (!pattern.test(upper)) continue;

    if (/S&P\s*500|\bVOO\b|\bIVV\b|\bSPY\b/i.test(upper)) {
      const issuer = extractOverseasEtfIssuer(original);
      const display = issuer
        ? trimLabel(`${issuer} S&P500`, ETF_LABEL_LEN)
        : trimLabel("미국 S&P500", MAX_LABEL_LEN);
      return { display, simplified: display !== original };
    }

    const display = buildEtfLabel(original, theme, index);
    return { display, simplified: display !== original };
  }

  const withoutEtf = original.replace(/\s+ETF(\s+Trust)?\s*$/i, "").trim();
  if (withoutEtf.length <= ETF_LABEL_LEN) {
    return { display: withoutEtf, simplified: withoutEtf !== original };
  }

  return { display: trimLabel(withoutEtf, ETF_LABEL_LEN), simplified: true };
}
