import { createContext } from "react";

import { FALLBACK_TIME_ZONE } from "./time-zone";

export type DateTimeContextValue = {
  timeZone: string;
  renderedAt: number | null;
  now: Date | null;
};

export const DateTimeContext = createContext<DateTimeContextValue>({
  timeZone: FALLBACK_TIME_ZONE,
  renderedAt: null,
  now: null,
});
