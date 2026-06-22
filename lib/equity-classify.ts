import { isKrxListedStock } from "@/lib/stock-universe";
import { isTrackableStock } from "@/lib/stock-filter";
import { inferAssetClass } from "@/lib/asset-class";
import { inferStockMarket, isKrxSixDigitCode } from "@/lib/stock-ticker-resolve";
import { isOverseasListedBondName } from "@/lib/overseas-listed-bond";
import { isKrBankSerialBondName } from "@/lib/kr-bank-bond";
import { isDomesticCommodityEtfName } from "@/lib/domestic-etf-product";

/** ETF 보유 스냅샷에서 주식이 아닌 것 (CD·스왑·선물·머니마켓·채권형 상품 등) */
const NON_EQUITY_NAME_RE =
  /설정현금|머니마켓|MMF|원화현금|원화$|양도성예금|예금증서|전자어음|전자단기|단기사채|전자단기사채|스왑|SWAP|TRS|총수익|국채\s*F\s*\d|\d+년\s*국채\s*F|국채선물|선물\d|\(CP\)|\(CP |CP\)|\(CD\)|\(CD |CD\)|\bCD\b|채권\d{3,}|사채\d|Debenture|Commercial Paper|\(단\)|\(할\)|\d{8}-\d+-\d+\((?:단|할)\)|(?:증권|투자증권|금융투자)\s*\d{8}-|^(?:T|SP)\s+\d[\d\s/%-]+\d{1,2}\/\d{1,2}\/\d{2,4}|\bETF\s*$|전단채|단기채플러스|\sF\s+\d{6}\s*$|TOP\s+\d+\s+F\s+\d{6}/i;

/** KODEX/TIGER 등 이름의 채권·머니마켓형 상장상품 (KRX 리스트에 포함되어도 주식 아님) */
const LISTED_BOND_PRODUCT_RE =
  /^(KODEX|TIGER|ARIRANG|RISE|SOL|ACE|HANARO|PLUS|1Q|KOSEF|TIMEFOLIO)\b.*(채|국고|머니|MMF|CD|금융채|회사채|통안|단기)/i;

/** 6자리 코드 중 KRX 주식 리스트에 없는 구조화·파생·채권 종목 (00000x 등) */
function isStructuredHoldingsCode(stockCode?: string | null): boolean {
  const code = (stockCode ?? "").trim();
  if (!isKrxSixDigitCode(code)) return false;
  if (isKrxListedStock(code)) return false;
  // 0000xx·1000xx는 해외주식 프록시로도 쓰임 — 종목명으로 판별
  if (/^(0000\d{2}|1000\d{2})$/.test(code)) return false;
  return /^00000[0-9]$/.test(code);
}

export function isNonEquityInstrument(stockName?: string | null, stockCode?: string | null): boolean {
  const name = (stockName ?? "").trim();
  if (!name) return isStructuredHoldingsCode(stockCode);

  if (NON_EQUITY_NAME_RE.test(name)) return true;
  if (isKrBankSerialBondName(name)) return true;
  if (isDomesticCommodityEtfName(name)) return true;
  if (isOverseasListedBondName(name)) return true;
  if (LISTED_BOND_PRODUCT_RE.test(name)) return true;
  if (isStructuredHoldingsCode(stockCode)) return true;

  return false;
}

/** KRX 상장 주식 또는 해외 상장 주식 (채권·CD·스왑·파생 제외) */
export function isListedEquity(
  stockName?: string | null,
  stockCode?: string | null,
  market?: "domestic" | "overseas" | "all",
): boolean {
  const name = (stockName ?? "").trim();
  const code = (stockCode ?? "").trim();

  if (!isTrackableStock(code, name)) return false;
  if (isNonEquityInstrument(name, code)) return false;
  if (inferAssetClass(name, code)) return false;

  const stockMarket = inferStockMarket(name, code, null);

  if (market === "domestic" && stockMarket !== "domestic") return false;
  if (market === "overseas" && stockMarket !== "overseas") return false;

  if (stockMarket === "domestic") {
    return isKrxListedStock(code);
  }

  return stockMarket === "overseas";
}

/** 국내 탭에 포함될 수 있는 종목 (국내 주식·채권·CD 등, 해외 주식 제외) */
export function isDomesticInstrument(stockName?: string | null, stockCode?: string | null): boolean {
  const name = (stockName ?? "").trim();
  const code = (stockCode ?? "").trim();
  const assetClass = inferAssetClass(name, code);

  if (assetClass === "overseas_bond") return false;

  const market = inferStockMarket(name, code, assetClass);
  return market === "domestic";
}

/** 해외 탭 — 해외 주식·해외채 */
export function isOverseasInstrument(stockName?: string | null, stockCode?: string | null): boolean {
  const name = (stockName ?? "").trim();
  const code = (stockCode ?? "").trim();
  const assetClass = inferAssetClass(name, code);
  const market = inferStockMarket(name, code, assetClass);
  return market === "overseas";
}
