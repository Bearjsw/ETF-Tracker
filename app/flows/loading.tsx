export default function FlowsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-24 rounded-lg bg-[var(--surface-muted)]" />
        <div className="h-4 w-full max-w-xl rounded bg-[var(--surface-muted)]" />
      </div>
      <div className="card h-16 bg-[var(--surface-muted)]" />
      <div className="card h-48 bg-[var(--surface-muted)]" />
      <div className="card h-28 bg-[var(--surface-muted)]" />
      <div className="card h-64 bg-[var(--surface-muted)]" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-36 bg-[var(--surface-muted)]" />
        ))}
      </div>
    </div>
  );
}
