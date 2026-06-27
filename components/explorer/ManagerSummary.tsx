import Link from "next/link";
import type { EtfUniverse, HoldingDiff } from "@/lib/types";
import { formatManagerDisplay } from "@/lib/managers";
import { HoldingsDiffTimeline } from "@/components/explorer/HoldingsDiffTimeline";
import { EtfList } from "@/components/explorer/EtfList";
import type { EtfListItem } from "@/lib/types";

type Props = {
  manager: string;
  etfs: EtfUniverse[];
  diffs: HoldingDiff[];
};

export function ManagerSummary({ manager, etfs, diffs }: Props) {
  const listItems: EtfListItem[] = etfs.map((etf) => ({
    ...etf,
    change_count: diffs.filter((d) => d.etf_ticker === etf.ticker).length,
  }));

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="page-title">{formatManagerDisplay(manager)}</h1>
        <p className="mt-2 text-[var(--muted)]">소속 ETF {etfs.length}개</p>
      </div>
      <EtfList etfs={listItems} />
      <HoldingsDiffTimeline diffs={diffs.slice(0, 50)} title="최근 보유 변화" />
      <div className="text-sm text-[var(--muted)]">
        ETF 상세는 목록의 티커를 클릭하세요. 종목 역추적은{" "}
        <Link href="/etfs" className="text-[var(--accent)]">
          ETF Explorer
        </Link>
        에서 종목 링크로 이동할 수 있습니다.
      </div>
    </div>
  );
}
