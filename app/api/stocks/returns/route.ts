import { NextResponse } from "next/server";
import { enrichPopularStocksWithReturns } from "@/lib/db/queries";
import type { PopularStock } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { stocks?: PopularStock[] };
    const stocks = Array.isArray(body.stocks) ? body.stocks.slice(0, 20) : [];
    if (!stocks.length) {
      return NextResponse.json([]);
    }

    const enriched = await enrichPopularStocksWithReturns(stocks, "1m");
    return NextResponse.json(
      enriched.map((s) => ({
        stock_code: s.stock_code,
        price_return_pct: s.price_return_pct ?? null,
      })),
    );
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
