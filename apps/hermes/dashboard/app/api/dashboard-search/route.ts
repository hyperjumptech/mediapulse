import { NextResponse } from "next/server";
import { z } from "zod";

import {
  DASHBOARD_UNAUTHORIZED_BODY,
  getDashboardPrincipalUser,
} from "@/lib/auth-dashboard";
import { searchDashboardEntities } from "@/lib/dashboard-search";
import {
  DASHBOARD_SEARCH_MAXIMUM_QUERY_LENGTH,
  type DashboardSearchResponse,
} from "@/lib/dashboard-search-contract";

const dashboardSearchParamsSchema = z.object({
  q: z.string().max(DASHBOARD_SEARCH_MAXIMUM_QUERY_LENGTH).default(""),
});

export const GET = async (request: Request): Promise<NextResponse> => {
  const user = await getDashboardPrincipalUser(request);
  if (!user) {
    return NextResponse.json(DASHBOARD_UNAUTHORIZED_BODY, { status: 401 });
  }

  const requestUrl = new URL(request.url);
  const rawQuery = requestUrl.searchParams.get("q") ?? undefined;
  const parsedSearchParams = dashboardSearchParamsSchema.safeParse({
    q: rawQuery,
  });
  if (!parsedSearchParams.success) {
    return NextResponse.json(
      {
        error: "Invalid search query",
        issues: parsedSearchParams.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const results = await searchDashboardEntities(parsedSearchParams.data.q);
  const responseBody: DashboardSearchResponse = { results };

  return NextResponse.json(responseBody);
};
