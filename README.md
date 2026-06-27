# ETF-Tracker (수렴진화)

pykrx 기반 국내 ETF 보유 데이터 수집 및 Explorer 대시보드.

## Stack

- Next.js 15 + React + Tailwind CSS
- Vercel Postgres (Neon) — `@neondatabase/serverless`
- Python scripts (pykrx, pandas, psycopg)
- GitHub Actions (daily collection)

## Setup

### 1. Vercel Postgres 생성

1. [Vercel Dashboard](https://vercel.com/dashboard) → 프로젝트 → **Storage** → **Create Database** → **Postgres** (Neon)
2. Region: `Seoul (icn1)` 권장
3. 생성 후 `POSTGRES_URL` 환경 변수가 자동으로 연결됩니다

### 2. 로컬 환경 변수

```bash
cp .env.local.example .env.local
```

Vercel CLI로 가져오기:

```bash
npx vercel link
npx vercel env pull .env.local
```

또는 Vercel Storage → `.env.local` 탭에서 `POSTGRES_URL`을 복사합니다.

### 3. 의존성 설치 & 마이그레이션

```bash
npm install
pip install -r requirements.txt
python scripts/run_migration.py
```

### 4. ETF 유니버스 시드

```bash
python scripts/seed_universe.py --xlsx "path/to/ETF_ALL.xlsx"
```

### 5. 데이터 수집

전체 파이프라인 (권장):

```bash
python scripts/run_pipeline.py --collect --limit 600
```

`run_pipeline.py`는 holdings 수집 → diff → signals → 주가 → NAV → `est_flow_krw` 보정까지 한 번에 실행합니다.

개별 단계:

```bash
python scripts/collect_daily.py
python scripts/compute_holdings_diff.py --date YYYY-MM-DD
python scripts/compute_signals.py --date YYYY-MM-DD
python scripts/collect_etf_nav_history.py --days 365 --limit 600 --all-crawl
python scripts/collect_stock_prices.py --days 365
python scripts/backfill_est_flow.py --recalculate
```

### 6. UI 실행

```bash
npm run dev
```

`.next` 캐시 손상·다중 dev 서버로 500이 나면:

```bash
npm run dev:clean
```

`public/logos`에 수천 개 SVG가 있어도 `next.config.ts`에서 watcher ignore가 적용됩니다.

`POSTGRES_URL`이 없으면 **데모 모드**(샘플 데이터)로 동작합니다.

### 7. 로고 동기화 (선택)

Figma보내기 폴더(`FIGMA_LOGOS_DIR`, 기본 `C:\Users\USER\figma_logos`)에서 `financial`·`stock`만 증분 복사:

```bash
npm run sync-logos
npm run audit-logos
```

## Environment

| Variable | Description |
|----------|-------------|
| `POSTGRES_URL` | Vercel Postgres 연결 문자열 (pooled) |
| `POSTGRES_URL_NON_POOLING` | 직접 연결 (마이그레이션용, 선택) |
| `KRX_ID` | KRX Data Marketplace ID |
| `KRX_PW` | KRX Data Marketplace password |
| `FIGMA_LOGOS_DIR` | Figma 로고 소스 경로 (선택) |

## GitHub Actions Secrets

`collect_daily.yml` requires:

- `POSTGRES_URL`
- `KRX_ID`
- `KRX_PW`

Schedule: weekdays 08:00 UTC (KST 17:00). NAV·주가 수집 및 `est_flow_krw` 보정 단계 포함.

`audit_logos.yml`: 주 1회 로고 커버리지 리포트 (`STRICT_LOGO_AUDIT=1`).

## Tests

```bash
npm test
```

`est-flow`·`formatKrw` 회귀 테스트 (AUM cap, 비정상 숫자).

## Vercel 배포

1. GitHub 저장소를 Vercel에 Import
2. **Storage → Postgres** 생성 (프로젝트에 연결)
3. `POSTGRES_URL`이 자동 주입되므로 별도 설정 불필요
4. Deploy

```bash
npx vercel --prod
```

## Routes

- `/` — 홈 대시보드 (시장 요약·종목/ETF 흐름 미리보기)
- `/market` — 설정·환매 (Δ상장좌수 × NAV)
- `/flows` — 리밸런싱 추정 (look-through 비중 변화)
- `/signals` — 시그널 피드
- `/etfs` — ETF 목록·필터
- `/etfs/[ticker]` — ETF 상세 + 보유 변화
- `/managers/[name]` — 운용사 요약
- `/stocks/[code]` — 종목 역조회

## 자금흐름 정의

| 화면 | 정의 |
|------|------|
| `/market` | Δ상장좌수 × NAV (설정·환매) |
| `/flows`, ETF 상세 | look-through 보유 비중 변화 × AUM (리밸런싱 추정) |

공통 로직: `lib/est-flow.ts`, `lib/fund-flow.ts`
