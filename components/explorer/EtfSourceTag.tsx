import Link from "next/link";
import type { HoldingDiff } from "@/lib/types";
import { formatManagerDisplay } from "@/lib/managers";
import { formatSignedKrw } from "@/lib/utils";

type Props = {
  etfTicker: string;
  etfName?: string | null;
  manager: string | null;
  changeType?: HoldingDiff["change_type"];
  flowKrw?: number | null;
  /** manager: 운용사명 · etfName: ETF명 (ChangeFeed 등) */
  labelMode?: "manager" | "etfName";
};

function flowFromProps(changeType: HoldingDiff["change_type"] | undefined, flowKrw: number | null | undefined) {
  if (flowKrw != null && flowKrw !== 0) return flowKrw;
  if (changeType === "new" || changeType === "weight_up") return 1;
  if (changeType === "removed" || changeType === "weight_down") return -1;
  return flowKrw ?? 0;
}

export function EtfSourceTag({
  etfTicker,
  etfName,
  manager,
  changeType,
  flowKrw,
  labelMode = "manager",
}: Props) {
  const net = flowFromProps(changeType, flowKrw);
  const isBuy = net > 0;
  const isSell = net < 0;
  const signed = formatSignedKrw(typeof net === "number" && Math.abs(net) > 1 ? net : flowKrw);
  const label =
    labelMode === "etfName" ? (etfName?.trim() || etfTicker) : formatManagerDisplay(manager);

  return (
    <Link
      href={`/etfs/${etfTicker}`}
      title={label}
      className={`etf-source-tag inline-flex max-w-full flex-col items-start gap-0.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
        isBuy
          ? "bg-[var(--positive-muted)] text-[var(--foreground)] hover:bg-[#fde8e8]"
          : isSell
            ? "bg-[var(--negative-muted)] text-[var(--foreground)] hover:bg-[#dff5d4]"
            : "bg-[#f0f2ef] text-[var(--foreground)] hover:bg-[#e6e9e4]"
      }`}
    >
      <span className="leading-snug">{label}</span>
      {signed ? (
        <span className={`tabular-nums leading-none ${isBuy ? "delta-positive" : "delta-negative"}`}>{signed}</span>
      ) : null}
    </Link>
  );
}
