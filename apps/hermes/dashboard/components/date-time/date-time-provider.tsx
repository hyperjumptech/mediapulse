"use client";

import type { ReactNode } from "react";

import { useDateTimeProviderValue } from "@/hooks/use-date-time";
import { useTimeZoneCookieSync } from "@/hooks/use-time-zone-cookie-sync";
import { DateTimeContext } from "@/lib/date-time/date-time-context";

type DateTimeProviderProps = {
  timeZone: string;
  renderedAt: number;
  children: ReactNode;
};

export const DateTimeProvider = ({
  timeZone,
  renderedAt,
  children,
}: DateTimeProviderProps) => {
  const value = useDateTimeProviderValue(timeZone, renderedAt);
  useTimeZoneCookieSync(timeZone);

  return <DateTimeContext value={value}>{children}</DateTimeContext>;
};
