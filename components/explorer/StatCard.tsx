type Props = {
  label: string;
  value: string;
  sub?: string;
  trend?: "positive" | "negative" | "neutral";
};

export function StatCard({ label, value, sub, trend = "neutral" }: Props) {
  const trendClass =
    trend === "positive" ? "text-[var(--positive)]" : trend === "negative" ? "text-[var(--negative)]" : "";

  return (
    <div className="card">
      <p className="text-label">{label}</p>
      <p className={`text-stat mt-1 ${trendClass}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p> : null}
    </div>
  );
}
