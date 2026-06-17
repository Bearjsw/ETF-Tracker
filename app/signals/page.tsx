import { SignalFeed } from "@/components/explorer/SignalFeed";
import { fetchSignals } from "@/lib/db/queries";

export default async function SignalsPage() {
  const signals = await fetchSignals(200);

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-semibold">Signals</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          신규편입(new_entry)과 active_rate 합의(consensus) 시그널을 표시합니다.
        </p>
      </div>
      <SignalFeed signals={signals} />
    </div>
  );
}
