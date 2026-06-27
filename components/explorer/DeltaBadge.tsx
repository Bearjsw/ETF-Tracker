import { cn } from "@/lib/cn";
import { formatDeltaPp, formatPercent, relativeWeightChange } from "@/lib/utils";

type Props = {
  delta: number | null | undefined;
  weightPrev?: number | null;
  weightCurr?: number | null;
  showRelative?: boolean;
  size?: "sm" | "md";
  align?: "start" | "end";
  /** 유형별 색 (비중 확대=연핑크, 축소=녹색). 없으면 delta 부호 기준 */
  toneClass?: string;
};

export function DeltaBadge({
  delta,
  weightPrev,
  weightCurr,
  showRelative = false,
  size = "md",
  align = "end",
  toneClass,
}: Props) {
  const value = delta ?? 0;
  const isPositive = value >= 0;
  const relative = showRelative ? relativeWeightChange(weightPrev, weightCurr) : null;
  const tone =
    toneClass ?? (isPositive ? "delta-positive" : "delta-negative");

  return (
    <div className={cn("metric-cell", align === "start" ? "metric-cell--start" : "metric-cell--end")}>
      <span
        className={cn(
          "metric-cell-value",
          size === "md" && "metric-cell-value-md",
          tone,
        )}
      >
        {formatDeltaPp(delta)}
      </span>
      {showRelative && relative != null ? (
        <span className={cn("metric-cell-sub", tone)}>
          {formatPercent(relative, 1, true)}
        </span>
      ) : null}
    </div>
  );
}
