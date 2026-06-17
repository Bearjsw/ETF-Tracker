import Link from "next/link";
import { HoldingsDiffTimeline } from "@/components/explorer/HoldingsDiffTimeline";
import { fetchStockHoldings } from "@/lib/db/queries";
import { formatNumber, strategyLabel } from "@/lib/utils";

type Params = Promise<{ code: string }>;

export default async function StockPage({ params }: { params: Params }) {
  const { code } = await params;
  const { holdings, etfs, diffs } = await fetchStockHoldings(code);
  const latestByEtf = new Map<string, (typeof holdings)[number]>();
  for (const row of holdings) {
    if (!latestByEtf.has(row.etf_ticker)) latestByEtf.set(row.etf_ticker, row);
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-semibold">종목 {code}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          이 종목을 보유한 ETF {latestByEtf.size}개 (최근 스냅샷 기준)
        </p>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-lg font-semibold">보유 ETF</h2>
        <table>
          <thead>
            <tr>
              <th>ETF</th>
              <th>운용사</th>
              <th>유형</th>
              <th>비중(%)</th>
              <th>기준일</th>
            </tr>
          </thead>
          <tbody>
            {[...latestByEtf.values()].map((row) => {
              const etf = etfs.find((e) => e.ticker === row.etf_ticker);
              return (
                <tr key={row.etf_ticker}>
                  <td>
                    <Link href={`/etfs/${row.etf_ticker}`} className="text-[var(--accent)]">
                      {etf?.name ?? row.etf_ticker}
                    </Link>
                  </td>
                  <td>{etf?.manager ?? "-"}</td>
                  <td>{etf ? strategyLabel(etf.strategy_type) : "-"}</td>
                  <td>{formatNumber(row.weight, 2)}</td>
                  <td>{row.date}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <HoldingsDiffTimeline diffs={diffs} title="이 종목 관련 보유 변화" />
    </div>
  );
}
