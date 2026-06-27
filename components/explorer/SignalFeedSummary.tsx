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
  const chips: { label: string; value?: number; tone?: "up" | "down" }[] = [];

  if (consensus > 0) {
    chips.push({ label: "합의", value: consensus });
  }
  if (showSplit) {
    chips.push({ label: "매집", value: accumulation, tone: "up" });
    chips.push({ label: "축소", value: distribution, tone: "down" });
  } else if (distribution > 0 && accumulation === 0) {
    chips.push({ label: "축소·제외 위주", tone: "down" });
  } else if (accumulation > 0 && distribution === 0 && consensus === 0) {
    chips.push({ label: "확대·편입 위주", tone: "up" });
  }

  if (!chips.length) return null;

  return (
    <div className="signal-feed-summary">
      <span className="signal-feed-summary__period">{dataPeriod}</span>
      <div className="signal-feed-summary__chips">
        {chips.map((chip) => (
          <span
            key={chip.label}
            className={`signal-feed-summary__chip${chip.tone ? ` signal-feed-summary__chip--${chip.tone}` : ""}`}
          >
            {chip.label}
            {chip.value != null ? <b>{chip.value.toLocaleString("ko-KR")}</b> : null}
          </span>
        ))}
      </div>
    </div>
  );
}
