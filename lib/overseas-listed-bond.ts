/** KRX ETF 보유 해외국채 Bloomberg 명명 — T, SP, KOREAT, KORWAT, KOROIL 등 */
export const OVERSEAS_LISTED_BOND_NAME_RE =
  /^(?:T|SP|KOREAT|KORWAT|KOROIL)\s+[\d\s./%-]+\d{1,2}\/\d{1,2}\/\d{2,4}/i;

export function isOverseasListedBondName(name?: string | null): boolean {
  const trimmed = name?.trim();
  if (!trimmed) return false;
  return OVERSEAS_LISTED_BOND_NAME_RE.test(trimmed);
}
