import { inferAssetClass } from "@/lib/asset-class";
import { isKrBankSerialBondName } from "@/lib/kr-bank-bond";

/** 채권·CP 등 비주식 자산 여부 */
export function isBondLikeAsset(stockName?: string | null, stockCode?: string | null): boolean {
  return inferAssetClass(stockName, stockCode) !== null;
}

/** KRX/Yahoo 주가 스파크라인 표시 가능 여부 */
export function canShowStockPriceChart(
  stockName?: string | null,
  stockCode?: string | null,
): boolean {
  return !isBondLikeAsset(stockName, stockCode);
}

type IssuerRule = { pattern: RegExp; logo: string };

/** 회사채·금융채·CP 발행사 → financial/stock 로고 (확장자 제외) */
const ISSUER_LOGO_RULES: IssuerRule[] = [
  { pattern: /^(?:케이비|KB)/i, logo: "financial/증권/KB" },
  { pattern: /^(?:엔에이치|NH)/i, logo: "financial/증권/NH투자" },
  { pattern: /^(?:아이비케이|IBK)|중소기업은행|기업은행/i, logo: "financial/증권/IBK투자" },
  { pattern: /^(?:비엔케이|BNK)/i, logo: "financial/증권/BNK투자" },
  { pattern: /미래에셋/, logo: "financial/증권/미래에셋" },
  { pattern: /신한(?:캐피탈|증권|투자|금융)?/, logo: "financial/증권/신한투자" },
  { pattern: /하나(?:캐피탈|증권|금융)?/, logo: "financial/증권/하나금융투자" },
  { pattern: /한화(?:캐피탈|증권|투자)?/, logo: "financial/증권/한화투자" },
  { pattern: /삼성(?:증권|캐피탈|카드)?/, logo: "financial/증권/삼성" },
  { pattern: /키움/, logo: "financial/증권/키움" },
  { pattern: /유진(?:캐피탈|투자)?/, logo: "financial/증권/유진투자" },
  { pattern: /메리츠/, logo: "financial/증권/메리츠" },
  { pattern: /대신/, logo: "financial/증권/대신" },
  { pattern: /NH(?:농협)?캐피탈|농협캐피탈/, logo: "financial/증권/NH투자" },
  { pattern: /우리(?:금융)?캐피탈|JB\s*우리캐피탈/, logo: "financial/증권/우리금융" },
  { pattern: /롯데(?:캐피탈|카드)?/, logo: "financial/카드/롯데" },
  { pattern: /현대(?:캐피탈|차증권)?/, logo: "financial/증권/현대차" },
  { pattern: /^(?:디비|DB)(?:금융|증권|캐피탈)?/i, logo: "financial/증권/DB금융투자" },
  { pattern: /^(?:에스케이|SK)(?:증권|캐피탈)?/i, logo: "financial/증권/SK" },
  { pattern: /^(?:아이엠|IM)(?:캐피탈|증권)?/i, logo: "financial/증권/한국투자" },
  { pattern: /산은캐피탈|KDB/, logo: "financial/은행/KDB산업" },
  { pattern: /국민(?:카드|은행)?/, logo: "financial/은행/국민" },
  { pattern: /한국전력/, logo: "stock/한국전력" },
  { pattern: /한국가스/, logo: "stock/한국가스공사" },
  { pattern: /주택금융/, logo: "financial/은행/주택금융공사" },
];

/** 발행사명 한글 음역 → 약어 (엔에이치 → NH) */
const ISSUER_NAME_PREFIXES: [RegExp, string][] = [
  [/^엔에이치/i, "NH"],
  [/^케이비/i, "KB"],
  [/^아이비케이/i, "IBK"],
  [/^비엔케이/i, "BNK"],
  [/^디비/i, "DB"],
  [/^에스케이/i, "SK"],
  [/^중소기업은행/i, "IBK"],
  [/^기업은행/i, "IBK"],
];

export function formatBondIssuerDisplayName(stockName: string): string {
  let name = stockName.trim();
  for (const [pattern, abbr] of ISSUER_NAME_PREFIXES) {
    if (pattern.test(name)) return name.replace(pattern, abbr);
  }
  return name;
}

/** 채권 UI용 발행사 짧은 이름 (삼성카드2826 → 삼성카드) */
export function extractBondIssuerShortName(stockName: string): string | null {
  const raw = stockName.trim();
  if (!raw) return null;

  const formatted = formatBondIssuerDisplayName(raw);
  const withoutSerial = formatted
    .replace(/\s*\d{8}-\d+-\d+.*$/, "")
    .replace(/\s*\(\d{2}-\d+\).*$/, "")
    .replace(/\d[\d\-()/]*$/, "")
    .trim();

  const cardMatch = withoutSerial.match(
    /^(삼성|국민|신한|우리|하나|현대|롯데|BC|NH|농협)카드/i,
  );
  if (cardMatch) return cardMatch[0];

  const typedMatch = withoutSerial.match(
    /^[\uAC00-\uD7A3A-Za-z]{2,10}(?:카드|캐피탈|증권|금융투자|공사|전력|가스|철도|도로|항공|마사|금융|은행)/,
  );
  if (typedMatch) return formatBondIssuerDisplayName(typedMatch[0]);

  if (isKrBankSerialBondName(raw)) {
    const bank = raw.match(/^([\uAC00-\uD7A3]+(?:은행|증권|금융투자|캐피탈|카드))/)?.[1];
    if (bank) return formatBondIssuerDisplayName(bank);
  }

  for (const { pattern } of ISSUER_LOGO_RULES) {
    if (pattern.test(raw)) {
      const head = withoutSerial.match(/^[\uAC00-\uD7A3A-Za-z]{2,10}/);
      if (head) return formatBondIssuerDisplayName(head[0]);
    }
  }

  if (/^[\uAC00-\uD7A3]{2,8}$/.test(withoutSerial)) return withoutSerial;

  return null;
}

export function resolveBondIssuerLogo(stockName?: string | null): string | null {
  const name = stockName?.trim();
  if (!name) return null;
  for (const { pattern, logo } of ISSUER_LOGO_RULES) {
    if (pattern.test(name)) return logo;
  }
  return null;
}
