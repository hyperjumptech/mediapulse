import { NextResponse } from "next/server";

import { getDashboardSession } from "@/lib/auth-dashboard";
import { getTickerById } from "@/lib/tickers";

/**
 * GET /api/tickers/[id]
 * Returns the full ticker (including all metadata) by ID. Requires dashboard session.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getDashboardSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const ticker = await getTickerById(id);
  if (!ticker) {
    return NextResponse.json({ error: "Ticker not found" }, { status: 404 });
  }

  return NextResponse.json(ticker);
}
