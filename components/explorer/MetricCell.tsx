import { cn } from "@/lib/utils";

export type MetricCellProps = {
  label: string;
  align?: "start" | "end";
  className?: string;
  children: React.ReactNode;
};

export function MetricCell({ label, align = "end", className, children }: MetricCellProps) {
  return (
    <div className={cn("metric-cell", align === "start" ? "metric-cell--start" : "metric-cell--end", className)}>
      <p className="text-label">{label}</p>
      {children}
    </div>
  );
}

export function MetricValue({
  children,
  tone = "default",
  size = "sm",
  className,
}: {
  children: React.ReactNode;
  tone?: "default" | "positive" | "negative" | "muted";
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "metric-cell-value",
        size === "md" && "metric-cell-value-md",
        tone === "positive" && "delta-positive",
        tone === "negative" && "delta-negative",
        tone === "muted" && "text-[var(--muted)]",
        className,
      )}
    >
      {children}
    </p>
  );
}
