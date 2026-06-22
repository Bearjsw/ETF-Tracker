import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const text = readFileSync(resolve(".env.local"), "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnv();
const sql = neon(process.env.POSTGRES_URL);

const stats = await sql`
  SELECT
    COUNT(*)::int AS change_count,
    TO_CHAR(MAX(d.date), 'YYYY-MM-DD') AS latest_date,
    TO_CHAR(MIN(d.date), 'YYYY-MM-DD') AS earliest_date
  FROM holdings_diff d
  INNER JOIN etf_universe u ON u.ticker = d.etf_ticker
  WHERE u.strategy_type IN ('active', 'theme')
    AND d.date >= (
      SELECT MAX(date) - 2::int * INTERVAL '1 day'
      FROM holdings_diff
    )
`;
console.log(stats[0]);
