import { useContext, useMemo, useState } from "react";

import { useNow } from "@/hooks/use-now";
import {
  DateTimeContext,
  type DateTimeContextValue,
} from "@/lib/date-time/date-time-context";
import {
  formatDateTime,
  toValidDate,
  type DateTimeInput,
  type DateTimeStyle,
} from "@/lib/date-time/format-date-time";
import {
  formatTimeZoneOffset,
  resolveTimeZone,
} from "@/lib/date-time/time-zone";
import { formatRelativeTime } from "@/lib/format-relative-time";

const RELATIVE_TIME_REFRESH_MILLISECONDS = 30_000;

export const useDateTimeProviderValue = (
  timeZone: string,
  renderedAt: number,
): DateTimeContextValue => {
  const now = useNow(RELATIVE_TIME_REFRESH_MILLISECONDS, renderedAt);

  return useMemo(
    () => ({ timeZone, renderedAt, now }),
    [timeZone, renderedAt, now],
  );
};

export type ResolvedDateTime = {
  timeZone: string;
  now: Date;
  referenceNow: Date;
};

export const useDateTime = (timeZoneOverride?: string): ResolvedDateTime => {
  const context = useContext(DateTimeContext);
  const [fallbackNow] = useState(() => new Date());
  const now = context.now ?? fallbackNow;
  const referenceNow =
    context.renderedAt === null ? now : new Date(context.renderedAt);

  return {
    timeZone: resolveTimeZone(timeZoneOverride, context.timeZone),
    now,
    referenceNow,
  };
};

export type DateTimeLabels = {
  iso: string;
  absolute: string;
  full: string;
  relative: string;
};

export const useDateTimeLabels = (
  value: DateTimeInput,
  { style, timeZone }: { style: DateTimeStyle; timeZone?: string },
): DateTimeLabels | null => {
  const resolved = useDateTime(timeZone);
  const date = toValidDate(value);
  if (!date) {
    return null;
  }
  const absolute = formatDateTime(date, {
    timeZone: resolved.timeZone,
    style,
    now: resolved.referenceNow,
  });
  const fullDateTime = formatDateTime(date, {
    timeZone: resolved.timeZone,
    style: "datetime",
  });
  const offset = formatTimeZoneOffset(resolved.timeZone, date);

  return {
    iso: date.toISOString(),
    absolute,
    full: `${fullDateTime} ${offset}`,
    relative: formatRelativeTime(date, resolved.now),
  };
};
