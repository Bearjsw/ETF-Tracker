import { ManagerSummary } from "@/components/explorer/ManagerSummary";
import { fetchManagerSummary } from "@/lib/db/queries";
import { notFound } from "next/navigation";

type Params = Promise<{ name: string }>;

export default async function ManagerPage({ params }: { params: Params }) {
  const { name } = await params;
  const manager = decodeURIComponent(name);
  const { etfs, diffs } = await fetchManagerSummary(manager);
  if (!etfs.length) notFound();

  return <ManagerSummary manager={manager} etfs={etfs} diffs={diffs} />;
}
