import { useRouter } from "next/navigation";
import { useEffect } from "react";

import {
  readBrowserTimeZone,
  TIME_ZONE_COOKIE,
} from "@/lib/date-time/time-zone";

const REFRESH_MARKER_KEY = "hermes_tz_refreshed";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const readCookieValue = (name: string): string | null => {
  const prefix = `${name}=`;
  const entry = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(prefix));

  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
};

const writeTimeZoneCookie = (timeZone: string) => {
  const encodedTimeZone = encodeURIComponent(timeZone);
  document.cookie = `${TIME_ZONE_COOKIE}=${encodedTimeZone}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
};

const claimRefreshFor = (timeZone: string): boolean => {
  try {
    if (window.sessionStorage.getItem(REFRESH_MARKER_KEY) === timeZone) {
      return false;
    }
    window.sessionStorage.setItem(REFRESH_MARKER_KEY, timeZone);

    return true;
  } catch {
    return false;
  }
};

export const useTimeZoneCookieSync = (renderedTimeZone?: string) => {
  const router = useRouter();

  useEffect(() => {
    const browserTimeZone = readBrowserTimeZone();
    if (!browserTimeZone) {
      return;
    }
    if (readCookieValue(TIME_ZONE_COOKIE) !== browserTimeZone) {
      writeTimeZoneCookie(browserTimeZone);
    }
    if (
      renderedTimeZone === undefined ||
      renderedTimeZone === browserTimeZone
    ) {
      return;
    }
    if (claimRefreshFor(browserTimeZone)) {
      router.refresh();
    }
  }, [renderedTimeZone, router]);
};
