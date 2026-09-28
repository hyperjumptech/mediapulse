import { cookies } from "next/headers";
import { cache } from "react";

import { env } from "@hermes/env";

import {
  formatDateTime,
  type DateTimeInput,
  type DateTimeStyle,
} from "./format-date-time";
import { resolveTimeZone, TIME_ZONE_COOKIE } from "./time-zone";

export type ViewerDateTimeContext = {
  timeZone: string;
  renderedAt: number;
};

export const getViewerDateTimeContext = cache(
  async (): Promise<ViewerDateTimeContext> => {
    const cookieStore = await cookies();
    const cookieTimeZone = cookieStore.get(TIME_ZONE_COOKIE)?.value;
    const timeZone = resolveTimeZone(
      cookieTimeZone,
      env.HERMES_DASHBOARD_DEFAULT_TIME_ZONE,
    );

    return { timeZone, renderedAt: Date.now() };
  },
);

export const formatViewerDateTime = async (
  value: DateTimeInput,
  style: DateTimeStyle = "datetime",
): Promise<string> => {
  const { timeZone, renderedAt } = await getViewerDateTimeContext();

  return formatDateTime(value, {
    timeZone,
    style,
    now: new Date(renderedAt),
  });
};
