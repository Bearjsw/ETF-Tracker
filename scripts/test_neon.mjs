import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const path = resolve(".env.local");
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnv();
const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
console.log("configured:", Boolean(url));
const sql = neon(url);

const count = await sql`
  SELECT COUNT(*)::int AS c
  FROM holdings_diff d
  INNER JOIN etf_universe u ON u.ticker = d.etf_ticker
  WHERE u.strategy_type IN ('active', 'theme')
`;
console.log("count:", count[0]?.c);

const rows = await sql`
  SELECT d.etf_ticker, d.stock_name, u.manager
  FROM holdings_diff d
  INNER JOIN etf_universe u ON u.ticker = d.etf_ticker
  WHERE u.strategy_type IN ('active', 'theme')
  ORDER BY d.date DESC
  LIMIT 3
`;
const enriched = await sql`
  SELECT
    d.*,
    u.name AS etf_name,
    u.manager,
    u.strategy_type,
    CASE
      WHEN p0.close IS NOT NULL AND p0.close > 0 AND p1.close IS NOT NULL
      THEN ((p1.close - p0.close) / p0.close * 100)
      ELSE NULL
    END AS return_since_change
  FROM holdings_diff d
  INNER JOIN etf_universe u ON u.ticker = d.etf_ticker
  LEFT JOIN prices_daily p0 ON p0.stock_code = d.stock_code AND p0.date = d.date
  LEFT JOIN LATERAL (
    SELECT close FROM prices_daily
    WHERE stock_code = d.stock_code
    ORDER BY date DESC
    LIMIT 1
  ) p1 ON TRUE
  WHERE u.strategy_type IN ('active', 'theme')
    AND (${null}::text IS NULL OR u.manager = ${null})
  ORDER BY d.date DESC, ABS(d.weight_delta) DESC NULLS LAST
  LIMIT 25
`;
console.log("enriched:", enriched.length);

const dateRows = await sql`SELECT MAX(date) AS latest_date FROM holdings_diff`;
const latest = dateRows[0]?.latest_date;
console.log("latest_date raw:", latest, typeof latest);
const statsDate = latest instanceof Date ? latest.toISOString().slice(0, 10) : String(latest).slice(0, 10);
console.log("statsDate:", statsDate);
const statsRows = await sql`
  SELECT COUNT(*)::int AS change_count
  FROM holdings_diff d
  INNER JOIN etf_universe u ON u.ticker = d.etf_ticker
  WHERE d.date = ${statsDate}::date
    AND u.strategy_type IN ('active', 'theme')
`;
console.log("stats count:", statsRows[0]?.change_count);
