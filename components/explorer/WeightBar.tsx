import { formatNumber } from "@/lib/utils";

type Props = {
  weight: number | null | undefined;
  maxWeight?: number;
  className?: string;
  variant?: "default" | "positive";
  accentColor?: string;
  showLabel?: boolean;
};

export function WeightBar({
  weight,
  maxWeight = 15,
  className = "",
  variant = "default",
  accentColor,
  showLabel = true,
}: Props) {
  const value = weight ?? 0;
  const width = maxWeight > 0 ? Math.min(100, (value / maxWeight) * 100) : 0;
  const defaultBarClass =
    variant === "positive" ? "bg-[var(--accent-bright)]" : "bg-[var(--border-subtle)]";

  return (
    <div className={`flex min-w-[8rem] items-center gap-2 ${className}`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--code-bg)]">
        <div
          className={`h-full rounded-full transition-all ${accentColor ? "" : defaultBarClass}`}
          style={{ width: `${width}%`, ...(accentColor ? { background: accentColor } : {}) }}
        />
      </div>
      {showLabel ? (
        <span className="w-14 shrink-0 text-right text-sm tabular-nums">{formatNumber(weight, 2)}%</span>
      ) : null}
    </div>
  );
}
