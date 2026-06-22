/** ETF 상품 자산군 — ETFScope 자산배분 체계와 동일 8분류 */

export type EtfAssetClassId =
  | "equity"
  | "bond"
  | "leverage_inverse"
  | "allocation"
  | "commodity"
  | "alternative"
  | "cash"
  | "currency";

export const ETF_ASSET_CLASS_LABELS: Record<EtfAssetClassId, string> = {
  equity: "주식",
  bond: "채권",
  leverage_inverse: "레버리지/인버스",
  allocation: "자산배분",
  commodity: "원자재",
  alternative: "대체투자",
  cash: "현금성",
  currency: "통화",
};

const LEVERAGE_RE = /레버리지|인버스|곱버스|\b2X\b|\b3X\b|-2X|-3X/i;
const CURRENCY_RE = /달러|엔화|위안|유로|파운드|통화|FX|커런시|달러선물|엔선물/i;
const COMMODITY_RE =
  /금현물|은현물|원유|구리|원자재|WTI|커머더티|골드|실버|금\s*ETF|은\s*ETF|KRX금|금속|농산물/i;
const ALLOCATION_RE =
  /타겟데이트|TDF|자산배분|멀티에셋|채권혼합|혼합액티브|밸런스|올웨더|생애주기/i;
const CASH_RE = /머니마켓|MMF|현금성|단기채권|국공채머니마켓|전단채|초단기채권|단기사채/i;
const BOND_RE =
  /채권|국고|국채|회사채|금융채|통안|CD|크레딧|종합채|단기변동|중기종합|장기국공|물가연동|하이일드/i;
const ALTERNATIVE_RE = /리츠|REIT|인프라|커버드콜|대체투자|헤지펀드|프라이빗|부동산/i;

/** ETF명 기반 자산군 추론 (KRX 상품명 패턴) */
export function inferEtfAssetClass(name?: string | null): EtfAssetClassId {
  const n = name?.trim() ?? "";
  if (!n) return "equity";

  if (LEVERAGE_RE.test(n)) return "leverage_inverse";
  if (CURRENCY_RE.test(n)) return "currency";
  if (COMMODITY_RE.test(n)) return "commodity";
  if (ALLOCATION_RE.test(n)) return "allocation";
  if (CASH_RE.test(n)) return "cash";
  if (BOND_RE.test(n)) return "bond";
  if (ALTERNATIVE_RE.test(n)) return "alternative";

  return "equity";
}

export function etfAssetClassLabel(id: EtfAssetClassId): string {
  return ETF_ASSET_CLASS_LABELS[id];
}

export function etfAssetClassTone(id: EtfAssetClassId): string {
  return `etf-category-tag--${id.replace(/_/g, "-")}`;
}

/** 홈 시장 구성 표시 순서 */
export const ETF_ASSET_CLASS_ORDER: EtfAssetClassId[] = [
  "equity",
  "leverage_inverse",
  "bond",
  "cash",
  "allocation",
  "commodity",
  "alternative",
  "currency",
];

/** 신규상장 페이지 자산군 필터 파싱 */
export function parseListingCategoryFilter(value?: string | null): EtfAssetClassId | "all" {
  if (!value || value === "all") return "all";
  return ETF_ASSET_CLASS_ORDER.includes(value as EtfAssetClassId)
    ? (value as EtfAssetClassId)
    : "all";
}
