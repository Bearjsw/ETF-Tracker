import { formatManagerShort } from "@/lib/utils";

/**
 * 운용사 표기 규칙
 * - DB/KRX 원문(영문·한글·(주) 등) → canonical 키 하나로 통합
 * - 약어형: KB, DB, IBK, BNK, NH, KCGI, SK + "자산운용"
 * - 그 외: 공식 한글명(삼성, 미래에셋, 교보악사 등)
 */
const MANAGER_CANONICAL: [RegExp, string][] = [
  [/삼성|samsung/i, "삼성자산운용"],
  [/미래에셋|mirae asset/i, "미래에셋자산운용"],
  [/^kb\b|케이비|kb asset|kb자산/i, "KB자산운용"],
  [/한국투자|korea investment|타임폴리오|timefolio/i, "한국투자신탁운용"],
  [/신한|shinhan/i, "신한자산운용"],
  [/^nh\b|엔에이치|nh아문디|아문디|amundi/i, "NH아문디자산운용"],
  [/키움|kiwoom/i, "키움투자자산운용"],
  [/하나|hana/i, "하나자산운용"],
  [/한화|hanwha/i, "한화자산운용"],
  [/\bbnk\b|비엔케이|bnk자산/i, "BNK자산운용"],
  [/\bibk\b|ibk자산|아이비케이/i, "IBK자산운용"],
  [/대신|daishin/i, "대신자산운용"],
  [/유진|eugene/i, "유진자산운용"],
  [/메리츠|meritz/i, "메리츠자산운용"],
  [/우리|woori/i, "우리자산운용"],
  [/교보|kyobo|악사/i, "교보악사자산운용"],
  [/흥국|heungkuk/i, "흥국자산운용"],
  [/현대|hyundai/i, "현대자산운용"],
  [/\bdb\b|디비자산/i, "DB자산운용"],
  [/^sk\b|에스케이|sk자산/i, "SK자산운용"],
  [/아이엠|im asset|im자산/i, "아이엠자산운용"],
  [/케이씨지아이|kcgi/i, "KCGI자산운용"],
  [/브이아이|\bvi asset|\bvi자산/i, "브이아이자산운용"],
  [/유리/i, "유리자산운용"],
  [/더제이|the j/i, "더제이자산운용"],
  [/마이다스|midas/i, "마이다스에셋자산운용"],
  [/에셋플러스|assetplus|asset plus/i, "에셋플러스자산운용"],
  [/트러스톤|truston/i, "트러스톤자산운용"],
];

function normalizeManagerRaw(manager: string): string {
  return formatManagerShort(manager)
    .replace(/^㈜\s*/g, "")
    .replace(/\s*㈜\s*$/g, "")
    .replace(/\(주\)/g, "")
    .trim();
}

/** Canonical key for grouping/filtering (merges EN/KO DB spellings). */
export function managerKey(manager: string | null | undefined): string {
  if (!manager) return "";
  const trimmed = normalizeManagerRaw(manager);
  for (const [pattern, canonical] of MANAGER_CANONICAL) {
    if (pattern.test(trimmed)) return canonical;
  }
  return trimmed;
}

/** UI display label — canonical 한글명 (NH·KB 등 약어로 축약하지 않음) */
export function formatManagerDisplay(manager: string | null | undefined): string {
  const key = managerKey(manager);
  return key || "운용사 미상";
}

export function buildManagerGroupMap(rawManagers: Iterable<string>): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const raw of rawManagers) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    const key = managerKey(trimmed);
    const bucket = map.get(key) ?? new Set<string>();
    bucket.add(trimmed);
    map.set(key, bucket);
  }

  const result = new Map<string, string[]>();
  for (const [key, bucket] of map) {
    result.set(
      key,
      [...bucket].sort((a, b) => a.localeCompare(b, "ko")),
    );
  }
  return result;
}

export function listManagerOptions(groupMap: Map<string, string[]>): string[] {
  return [...groupMap.keys()].sort((a, b) => a.localeCompare(b, "ko"));
}

export function resolveManagerVariants(
  groupMap: Map<string, string[]>,
  manager?: string | null,
): string[] | null {
  if (!manager) return null;
  const key = managerKey(manager);
  return groupMap.get(key) ?? [manager];
}

export function matchesManagerFilter(
  rawManager: string | null | undefined,
  filter?: string | null,
): boolean {
  if (!filter) return true;
  return managerKey(rawManager) === managerKey(filter);
}
