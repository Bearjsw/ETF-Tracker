type Props = {
  signalCount: number;
  accumulation: number;
  distribution: number;
  consensus: number;
  dataPeriod: string;
};

/** 시그널 피드 상단 — 합의·방향 편중만 짧게 (필터·목록과 중복되는 숫자는 생략) */
export function SignalFeedSummary({
  signalCount,
  accumulation,
  distribution,
  consensus,
  dataPeriod,
}: Props) {
  if (!signalCount) return null;

  const showSplit = accumulation > 0 && distribution > 0;
  const hints: string[] = [];

  if (consensus > 0) {
    hints.push(`합의 ${consensus.toLocaleString("ko-KR")}건`);
  }
  if (showSplit) {
    hints.push(`매집 ${accumulation} · 축소 ${distribution}`);
  } else if (distribution > 0 && accumulation === 0) {
    hints.push("축소·제외 위주");
  } else if (accumulation > 0 && distribution === 0 && consensus === 0) {
    hints.push("확대·편입 위주");
  }

  if (!hints.length) return null;

  return (
    <p className="signal-feed-summary text-sm text-[var(--muted)]">
      <span>{dataPeriod}</span>
      <span aria-hidden className="mx-1.5 text-[var(--border-subtle)]">
        ·
      </span>
      <span>{hints.join(" · ")}</span>
    </p>
  );
}
