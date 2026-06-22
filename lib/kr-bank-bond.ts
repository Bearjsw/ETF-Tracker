/** 국내 은행·금융사 발행 채권/CP 일련코드 — 중소기업은행(신)2505할1A-28 등 */
export const KR_BANK_SERIAL_BOND_RE =
  /^[\uAC00-\uD7A3]+(?:은행|증권|금융투자|캐피탈|카드)\([^)]+\)\d{4}(?:할|이)/;

export const KR_BANK_CD_RE = /^[\uAC00-\uD7A3]+은행\(CD\)$/i;

export function isKrBankSerialBondName(name?: string | null): boolean {
  const trimmed = name?.trim();
  if (!trimmed) return false;
  return KR_BANK_SERIAL_BOND_RE.test(trimmed) || KR_BANK_CD_RE.test(trimmed);
}

/** 할인어음(할) · (단) → CP, 이표(이) → 금융채 */
export function isKrBankDiscountBond(name: string): boolean {
  return /\)\d{4}할/.test(name) || /\((?:단|할)\)/.test(name);
}

export function parseKrBankBondYymm(name: string): string | null {
  const yymm = name.match(/\)(\d{4})(?:할|이)/)?.[1];
  if (!yymm) return null;
  return `${yymm.slice(0, 2)}.${yymm.slice(2, 4)}`;
}

export function extractKrBankBondIssuer(name: string): string | null {
  return name.match(/^([\uAC00-\uD7A3]+(?:은행|증권|금융투자|캐피탈|카드))/)?.[1] ?? null;
}
