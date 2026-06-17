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

```bash
python scripts/collect_daily.py
python scripts/compute_holdings_diff.py --date YYYY-MM-DD
python scripts/compute_signals.py --date YYYY-MM-DD
```

### 6. UI 실행

```bash
npm run dev
```

`POSTGRES_URL`이 없으면 **데모 모드**(샘플 데이터)로 동작합니다.

## Environment

| Variable | Description |
|----------|-------------|
| `POSTGRES_URL` | Vercel Postgres 연결 문자열 (pooled) |
| `POSTGRES_URL_NON_POOLING` | 직접 연결 (마이그레이션용, 선택) |
| `KRX_ID` | KRX Data Marketplace ID |
| `KRX_PW` | KRX Data Marketplace password |

## GitHub Actions Secrets

`collect_daily.yml` requires:

- `POSTGRES_URL`
- `KRX_ID`
- `KRX_PW`

Schedule: weekdays 08:00 UTC (KST 17:00).

## Vercel 배포

1. GitHub 저장소를 Vercel에 Import
2. **Storage → Postgres** 생성 (프로젝트에 연결)
3. `POSTGRES_URL`이 자동 주입되므로 별도 설정 불필요
4. Deploy

```bash
npx vercel --prod
```

## Routes

- `/etfs` — ETF list with filters
- `/etfs/[ticker]` — ETF detail + holdings changes
- `/managers/[name]` — Manager summary
- `/stocks/[code]` — Stock reverse lookup
- `/signals` — Signal feed
