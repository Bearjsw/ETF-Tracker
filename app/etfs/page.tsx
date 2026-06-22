import { EtfPeriodTabs } from "@/components/explorer/EtfPeriodTabs";
import { EtfReturnRankList } from "@/components/explorer/EtfReturnRankList";
import { PageHeader } from "@/components/explorer/PageHeader";
import { Suspense } from "react";
import { parseReturnPeriod } from "@/lib/rankings";
import { fetchEtfReturnRankings, fetchManagers } from "@/lib/db/queries";
import { formatManagerDisplay } from "@/lib/managers";
import Link from "next/link";

type SearchParams = Promise<{
  manager?: string;
  strategy?: string;
  market?: string;
  listed?: string;
  period?: string;
}>;

export default async function EtfsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const period = parseReturnPeriod(params.period);

  const filters = {
    manager: params.manager,
    strategy: params.strategy ?? "active",
    market: params.market,
    listedOnly: params.listed !== "0",
  };

  const managers = await fetchManagers();
  const ranked = await fetchEtfReturnRankings(filters, period, 50);

  return (
    <div className="space-y-8">
      <PageHeader
        title="액티브 ETF"
        description="시장 종가 기준 수익률 순위입니다. 1일·1주·1달·3달·1년 전 대비 ETF 수익률을 비교할 수 있습니다."
        action={
          <Link href="/" className="btn-ghost text-sm">
            변화 피드
          </Link>
        }
      />

      <form method="get" className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input type="hidden" name="period" value={period} />
        <select name="manager" defaultValue={params.manager ?? ""} className="select-input">
          <option value="">전체 운용사</option>
          {managers.map((manager) => (
            <option key={manager} value={manager}>
              {formatManagerDisplay(manager)}
            </option>
          ))}
        </select>
        <select name="strategy" defaultValue={params.strategy ?? "active"} className="select-input">
          <option value="active">액티브</option>
          <option value="theme">테마</option>
          <option value="passive">패시브</option>
          <option value="">전체 유형</option>
        </select>
        <select name="market" defaultValue={params.market ?? ""} className="select-input">
          <option value="">전체 시장</option>
          <option value="KOSPI">KOSPI</option>
          <option value="KOSDAQ">KOSDAQ</option>
        </select>
        <select name="listed" defaultValue={params.listed ?? "1"} className="select-input">
          <option value="1">상장중만</option>
          <option value="0">전체</option>
        </select>
        <button type="submit" className="btn-primary sm:col-span-2 lg:col-span-1">
          적용
        </button>
      </form>

      <Suspense fallback={null}>
        <EtfPeriodTabs current={{ period }} />
      </Suspense>
      <EtfReturnRankList items={ranked} period={period} showSparkline={false} />
    </div>
  );
}
