import { NextResponse } from "next/server";

import { isValidTimeZone } from "@/lib/date-time/time-zone";
import { getOverviewForApi } from "@/lib/overview-api";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const DEFAULT_DAYS = 30;

const MAX_DAYS = 90;

const parseDays = (value: string | null): number => {
  const days = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(days) || days < 1) {
    return DEFAULT_DAYS;
  }

  return Math.min(days, MAX_DAYS);
};

export const GET = async (request: Request): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const searchParams = new URL(request.url).searchParams;
  const timeZone = searchParams.get("timeZone") ?? "UTC";
  if (!isValidTimeZone(timeZone)) {
    return NextResponse.json({ error: "Unknown time zone" }, { status: 400 });
  }
  const days = parseDays(searchParams.get("days"));
  const overview = await getOverviewForApi({
    days,
    timeZone,
    now: new Date(),
  });

  return NextResponse.json(overview);
};
