import { NextResponse } from "next/server";

import {
  expandSingleDataSource,
  parseDataSourceString,
} from "@workspace/hermes-scheduler";
import { prisma } from "@workspace/database";

import { getDashboardSession } from "@/lib/auth-dashboard";

type PreviewBody = { expansionString?: string };

/**
 * POST /api/data-source-expansions/preview
 * Runs a single data source expansion string and returns the resulting values.
 * Requires dashboard session.
 */
export async function POST(request: Request) {
  const session = await getDashboardSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PreviewBody;
  try {
    body = (await request.json()) as PreviewBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const expansionString =
    typeof body.expansionString === "string" ? body.expansionString.trim() : "";
  if (!expansionString) {
    return NextResponse.json(
      { success: false, error: "expansionString is required" },
      { status: 400 },
    );
  }

  const parsed = parseDataSourceString(expansionString);
  if (!parsed) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Invalid format. Expected db:table:field?options (e.g. where.key=value, distinct, take, orderBy)",
      },
      { status: 400 },
    );
  }

  const values = await expandSingleDataSource(parsed, prisma);
  if (values === null) {
    return NextResponse.json(
      {
        success: false,
        error: `Unknown or unsupported table: ${parsed.table}`,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, values });
}
