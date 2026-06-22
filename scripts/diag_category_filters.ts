/**
 * Validate stock category filters against holdings_daily (uses production TS logic).
 * Run: python scripts/export_holdings_codes.py && npx tsx scripts/diag_category_filters.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { inferAssetClass } from "../lib/asset-class";
import { isDomesticInstrument, isListedEquity, isNonEquityInstrument } from "../lib/equity-classify";
import {
  classifyStock,
  countByCategory,
  matchesStockFilters,
  type StockCategoryFilter,
  type StockMarket,
} from "../lib/stock-filters";
import { isKrxListedStock } from "../lib/stock-universe";
import { isTrackableStock } from "../lib/stock-filter";
import { inferStockMarket } from "../lib/stock-ticker-resolve";

type Row = { stock_code: string; stock_name: string | null };

function loadStocks(): Row[] {
  const cache = resolve(process.cwd(), "scripts/.data/holdings_codes.json");
  try {
    return JSON.parse(readFileSync(cache, "utf8")) as Row[];
  } catch {
    throw new Error("Run: python scripts/export_holdings_codes.py");
  }
}

const DOMESTIC_FILTERS: StockCategoryFilter[] = [
  "all",
  "equity",
  "bond",
  "gov_bond",
  "fin_bond",
  "credit_bond",
];

function looksLikeBondName(name: string): boolean {
  return /국고|국채|통안|금융채|회사채|사채|CP\)|\(단\)|\(할\)|\(CD\)|단기사채|채권\d|해외.*채|Commercial Paper|Debenture/i.test(
    name,
  );
}

function looksLikeEquityName(name: string, code: string): boolean {
  if (/[A-Z]{4,}/.test(name) && !/[\uAC00-\uD7A3]{2,}/.test(name)) return true;
  return isKrxListedStock(code) && !looksLikeBondName(name);
}

async function main() {
  const allStocks = loadStocks();
  const stocks = allStocks.filter((s) => isTrackableStock(s.stock_code, s.stock_name));

  console.log(`\n=== 종목 분류 검증 (UI trackable ${stocks.length} / holdings ${allStocks.length}) ===\n`);

  for (const market of ["domestic", "all"] as const) {
    const counts = countByCategory(stocks, market);
    console.log(`[${market === "domestic" ? "국내" : "전체"}] 카운트:`, counts);
    const bondSub =
      counts.gov_bond + counts.fin_bond + counts.credit_bond + (market === "all" ? counts.overseas_bond : 0);
    console.log(
      `  채권(상위)=${counts.bond}, 세부합=${bondSub}, 주식=${counts.equity}, 전체=${counts.all}`,
    );
  }

  type Issue = { kind: string; code: string; name: string; detail: string };
  const issues: Issue[] = [];

  for (const { stock_code: code, stock_name: nameRaw } of stocks) {
    const name = (nameRaw ?? "").trim();
    const cls = classifyStock(name, code);
    const asset = inferAssetClass(name, code);
    const market = inferStockMarket(name, code, asset);
    const isEquity = isListedEquity(name, code);
    const isDomestic = isDomesticInstrument(name, code);

    // 1) 주식 필터에 들어가지만 채권/CP/비주식으로 보이는 것
    if (matchesStockFilters(name, code, "domestic", "equity") && looksLikeBondName(name)) {
      issues.push({
        kind: "equity_filter_bond_name",
        code,
        name,
        detail: `category=${cls.category}, asset=${asset}`,
      });
    }

    // 2) KRX 상장인데 주식 필터 제외 (국내 탭)
    if (
      isDomestic &&
      isKrxListedStock(code) &&
      !isNonEquityInstrument(name, code) &&
      !asset &&
      !isEquity &&
      !looksLikeBondName(name)
    ) {
      issues.push({
        kind: "missing_from_equity",
        code,
        name,
        detail: `market=${market}, category=${cls.category}`,
      });
    }

    // 3) 주식 필터 포함인데 KRX 미상장 국내 6자리 (해외 프록시 제외)
    if (
      matchesStockFilters(name, code, "domestic", "equity") &&
      !isKrxListedStock(code) &&
      market === "domestic"
    ) {
      issues.push({
        kind: "equity_not_krx_listed",
        code,
        name,
        detail: `market=${market}`,
      });
    }

    // 4) 채권 세부 필터 불일치 — classify vs assetClass
    if (asset && cls.category === "equity") {
      issues.push({
        kind: "asset_class_but_equity_category",
        code,
        name,
        detail: `asset=${asset}`,
      });
    }

    // 5) 국내 채권인데 어느 채권 필터에도 안 잡힘
    if (
      isDomestic &&
      asset &&
      asset !== "overseas_bond" &&
      !matchesStockFilters(name, code, "domestic", "bond")
    ) {
      issues.push({
        kind: "bond_not_in_bond_filter",
        code,
        name,
        detail: `asset=${asset}, category=${cls.category}`,
      });
    }

    // 6) 주식처럼 보이는데 채권 필터에만 있음
    if (
      isDomestic &&
      looksLikeEquityName(name, code) &&
      !asset &&
      matchesStockFilters(name, code, "domestic", "bond") &&
      !matchesStockFilters(name, code, "domestic", "equity")
    ) {
      issues.push({
        kind: "bond_filter_likely_equity",
        code,
        name,
        detail: `category=${cls.category}, nonEq=${isNonEquityInstrument(name, code)}`,
      });
    }

    // 7) 분류 공백 — 국내인데 equity도 bond도 아님
    const inDomesticAll = matchesStockFilters(name, code, "domestic", "all");
    const inEquity = matchesStockFilters(name, code, "domestic", "equity");
    const inBond = matchesStockFilters(name, code, "domestic", "bond");
    if (inDomesticAll && !inEquity && !inBond) {
      issues.push({
        kind: "domestic_orphan",
        code,
        name,
        detail: `category=${cls.category}, asset=${asset}, market=${market}`,
      });
    }
  }

  const byKind = new Map<string, Issue[]>();
  for (const issue of issues) {
    if (!byKind.has(issue.kind)) byKind.set(issue.kind, []);
    byKind.get(issue.kind)!.push(issue);
  }

  console.log("\n=== 이슈 요약 ===");
  if (issues.length === 0) {
    console.log("의심 케이스 없음");
  } else {
    for (const [kind, list] of [...byKind.entries()].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`\n--- ${kind} (${list.length}) ---`);
      for (const item of list.slice(0, 20)) {
        console.log(`  ${item.code}  ${item.name}`);
        console.log(`    ${item.detail}`);
      }
      if (list.length > 20) console.log(`  ... +${list.length - 20} more`);
    }
  }

  const bondsInEquity = stocks.filter(
    (s) =>
      matchesStockFilters(s.stock_name, s.stock_code, "domestic", "equity") &&
      inferAssetClass(s.stock_name, s.stock_code),
  );
  const cashInBond = stocks.filter(
    (s) =>
      matchesStockFilters(s.stock_name, s.stock_code, "domestic", "bond") &&
      /설정현금|원화현금|머니마켓|MMF|현금/i.test(s.stock_name ?? ""),
  );
  const cpInEquity = stocks.filter(
    (s) =>
      matchesStockFilters(s.stock_name, s.stock_code, "domestic", "equity") &&
      /\(CP\)|\(CD\)|\(단\)|\(할\)|국고|국채|금융채|회사채/i.test(s.stock_name ?? ""),
  );
  const filterBondCount = stocks.filter((s) =>
    matchesStockFilters(s.stock_name, s.stock_code, "domestic", "bond"),
  ).length;
  const filterEquityCount = stocks.filter((s) =>
    matchesStockFilters(s.stock_name, s.stock_code, "domestic", "equity"),
  ).length;

  console.log("\n=== 핵심 점검 ===");
  console.log(`국내 주식 필터: ${filterEquityCount}건`);
  console.log(`국내 채권 필터: ${filterBondCount}건`);
  console.log(`국내 전체: ${stocks.filter((s) => matchesStockFilters(s.stock_name, s.stock_code, "domestic", "all")).length}건`);
  console.log(`주식∩채권 assetClass 있음 (오분류): ${bondsInEquity.length}건`);
  console.log(`주식 필터 내 채권명 패턴: ${cpInEquity.length}건`);
  console.log(`채권 필터 내 현금/유동성: ${cashInBond.length}건`);

  if (bondsInEquity.length) {
    console.log("\n[주식 필터 오분류 — assetClass 있음]");
    for (const s of bondsInEquity.slice(0, 15)) {
      console.log(`  ${s.stock_code}  ${s.stock_name}  (${inferAssetClass(s.stock_name, s.stock_code)})`);
    }
  }
  if (cpInEquity.length) {
    console.log("\n[주식 필터 — 채권/CP 이름]");
    for (const s of cpInEquity.slice(0, 15)) {
      console.log(`  ${s.stock_code}  ${s.stock_name}`);
    }
  }
  if (cashInBond.length) {
    console.log("\n[채권 필터 — 현금류 (제외 권장)]");
    for (const s of cashInBond.slice(0, 10)) {
      console.log(`  ${s.stock_code}  ${s.stock_name}`);
    }
  }

  const bondNoSub = stocks.filter((s) => {
    if (!matchesStockFilters(s.stock_name, s.stock_code, "domestic", "bond")) return false;
    const c = classifyStock(s.stock_name, s.stock_code);
    return !["gov_bond", "fin_bond", "corp_bond", "agency_bond", "cp", "overseas_bond"].includes(
      c.category,
    );
  });
  console.log(`\n채권 필터 중 세부 미분류: ${bondNoSub.length}건`);
  for (const s of bondNoSub.slice(0, 20)) {
    const c = classifyStock(s.stock_name, s.stock_code);
    console.log(`  ${s.stock_code}  ${s.stock_name}  (category=${c.category}, asset=${c.assetClass})`);
  }

  // Sample: each domestic category filter first 3 items
  console.log("\n=== 국내 필터 샘플 (각 3건) ===");
  for (const cat of DOMESTIC_FILTERS) {
    const matched = stocks
      .filter((s) => matchesStockFilters(s.stock_name, s.stock_code, "domestic", cat))
      .slice(0, 3);
    console.log(`\n[${cat}]`);
    for (const s of matched) {
      const c = classifyStock(s.stock_name, s.stock_code);
      console.log(
        `  ${s.stock_code}  ${s.stock_name}  → ${c.category}${c.assetClass ? ` (${c.assetClass})` : ""}`,
      );
    }
  }

  await Promise.resolve();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
