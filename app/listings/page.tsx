import { redirect } from "next/navigation";

type SearchParams = Promise<{ category?: string }>;

export default async function ListingsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = params.category ? `?category=${encodeURIComponent(params.category)}` : "";
  redirect(`/market${q}#listings`);
}
