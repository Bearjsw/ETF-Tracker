# ETF_ALL.xlsx column mapping (verified)

Source: `ETF_ALL.xlsx` Sheet1 — **1,070 rows**, **23 columns**

## Actual columns

`종목코드`, `종목명`, `종목약명`, `기초지수명`, `기초지수종목수`, `기초지수산출기관`, `추적배수`, `기초시장분류`, `기초자산분류`, `상장일`, `설정일`, `순자산총액(원)`, `CU수량`, `총보수`, `운용사`, `ETP분류`, `지수산출기관`, `지수산출방식`, `복제추적`, `상장좌수`, `최소거래단위`, `과세유형`, `분배금`

## Mapping used by seed_universe

| DB field | XLSX column |
|----------|-------------|
| ticker | 종목코드 |
| name | 종목약명 (fallback 종목명) |
| manager | 운용사 |
| market | 기초시장분류 |
| strategy_type | ETP분류 + 복제추적 + 지수산출방식 + 기초지수명 |
| theme_tags | 기초자산분류, 기초지수명, ETP분류 |
| listing_date | 상장일 |

## crawl_enabled

`is_listed=true` AND `strategy_type` in (`active`, `theme`).

Run:

```bash
python scripts/seed_universe.py --analyze-only
```
