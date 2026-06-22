type Props = {
  signalCount: number;
  accumulation: number;
  distribution: number;
  consensus: number;
  activeEtfCount: number;
  managerCount: number;
  dataPeriod: string;
};

function StatTile({
  label,
  value,
  sub,
  valueTone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  valueTone?: "neutral" | "positive" | "negative";
}) {
  const valueClass =
    valueTone === "positive"
      ? "text-[var(--positive)]"
      : valueTone === "negative"
        ? "text-[var(--negative)]"
        : "";

  return (
    <div className="card signal-dashboard-stat">
      <p className="text-label">{label}</p>
      <p className={`text-stat mt-1 ${valueClass}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p> : null}
    </div>
  );
}

export function SignalFeedDashboard({
  signalCount,
  accumulation,
  distribution,
  consensus,
  activeEtfCount,
  managerCount,
  dataPeriod,
}: Props) {
  return (
    <div className="signal-dashboard-grid" aria-label="시그널 피드 요약">
      <StatTile
        label="표시 시그널"
        value={`${signalCount.toLocaleString("ko-KR")}`}
        sub={`${dataPeriod} · 현재 필터`}
      />
      <StatTile
        label="매집"
        value={`${accumulation.toLocaleString("ko-KR")}`}
        sub="비중 확대·신규 편입"
        valueTone="positive"
      />
      <StatTile
        label="축소"
        value={`${distribution.toLocaleString("ko-KR")}`}
        sub="비중 축소·제외"
        valueTone="negative"
      />
      <StatTile
        label="합의"
        value={`${consensus.toLocaleString("ko-KR")}`}
        sub="다수 ETF 동시 방향"
      />
      <StatTile
        label="추적 ETF"
        value={`${activeEtfCount.toLocaleString("ko-KR")}`}
        sub={`운용사 ${managerCount.toLocaleString("ko-KR")}곳`}
      />
    </div>
  );
}
