import { EtfList } from "@/components/explorer/EtfList";
import { fetchEtfList, fetchManagers } from "@/lib/db/queries";
import Link from "next/link";

type SearchParams = Promise<{
  manager?: string;
  strategy?: string;
  market?: string;
  listed?: string;
}>;

export default async function EtfsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const etfs = await fetchEtfList({
    manager: params.manager,
    strategy: params.strategy,
    market: params.market,
    listedOnly: params.listed === "1",
  });
  const managers = await fetchManagers();

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-semibold">ETF Explorer</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          액티브·테마 ETF 우선 수집 대상. 필터로 운용사·유형·시장을 좁혀보세요.
        </p>
        <form method="get" className="mt-4 grid gap-3 md:grid-cols-4">
          <select name="manager" defaultValue={params.manager ?? ""} className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2">
            <option value="">전체 운용사</option>
            {managers.map((manager) => (
              <option key={manager} value={manager}>
                {manager}
              </option>
            ))}
          </select>
          <select name="strategy" defaultValue={params.strategy ?? ""} className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2">
            <option value="">전체 유형</option>
            <option value="active">액티브</option>
            <option value="theme">테마</option>
            <option value="passive">패시브</option>
          </select>
          <select name="market" defaultValue={params.market ?? ""} className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2">
            <option value="">전체 시장</option>
            <option value="KOSPI">KOSPI</option>
            <option value="KOSDAQ">KOSDAQ</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="listed" value="1" defaultChecked={params.listed === "1"} />
            상장중만
          </label>
          <button type="submit" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white md:col-span-4 md:w-fit">
            필터 적용
          </button>
        </form>
      </div>
      <EtfList etfs={etfs} />
      <p className="text-sm text-[var(--muted)]">
        운용사 상세는 ETF 목록의 운용사 링크 또는{" "}
        <Link href="/managers" className="text-[var(--accent)]">
          /managers/[name]
        </Link>
        경로로 이동합니다.
      </p>
    </div>
  );
}
