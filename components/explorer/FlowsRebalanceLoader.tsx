import { EtfRebalanceFlowSection } from "@/components/explorer/EtfRebalanceFlowSection";
import { fetchEtfFlowSnapshot } from "@/lib/db/queries";

type Props = {
  manager?: string;
};

export async function FlowsRebalanceLoader({ manager }: Props) {
  const snapshot = await fetchEtfFlowSnapshot(manager);
  if (!snapshot) return null;
  return <EtfRebalanceFlowSection snapshot={snapshot} manager={manager} />;
}

export function FlowsRebalanceSkeleton() {
  return <div className="card h-48 animate-pulse bg-[var(--surface-muted)]" />;
}
