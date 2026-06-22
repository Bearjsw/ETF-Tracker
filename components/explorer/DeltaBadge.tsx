import { cn, formatDeltaPp, formatPercent, relativeWeightChange } from "@/lib/utils";

type Props = {
  delta: number | null | undefined;
  weightPrev?: number | null;
  weightCurr?: number | null;
  showRelative?: boolean;
  size?: "sm" | "md";
  align?: "start" | "end";
};

export function DeltaBadge({
  delta,
  weightPrev,
  weightCurr,
  showRelative = false,
  size = "md",
  align = "end",
}: Props) {
  const value = delta ?? 0;
  const isPositive = value >= 0;
  const relative = showRelative ? relativeWeightChange(weightPrev, weightCurr) : null;

  return (
    <div className={cn("metric-cell", align === "start" ? "metric-cell--start" : "metric-cell--end")}>
      <span
        className={cn(
          "metric-cell-value",
          size === "md" && "metric-cell-value-md",
          isPositive ? "delta-positive" : "delta-negative",
        )}
      >
        {formatDeltaPp(delta)}
      </span>
      {showRelative && relative != null ? (
        <span className={cn("metric-cell-sub", isPositive ? "delta-positive" : "delta-negative")}>
          {formatPercent(relative, 1, true)}
        </span>
      ) : null}
    </div>
  );
}
