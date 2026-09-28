import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("@/lib/date-time/time-zone", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/date-time/time-zone")>();

  return { ...original, readBrowserTimeZone: () => "Asia/Jakarta" };
});

import { useTimeZoneCookieSync } from "./use-time-zone-cookie-sync";

const clearTimeZoneCookie = () => {
  document.cookie = "hermes_tz=; path=/; max-age=0";
};

describe("useTimeZoneCookieSync", () => {
  beforeEach(() => {
    clearTimeZoneCookie();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    refreshMock.mockReset();
  });

  it("stores the browser time zone in a cookie", () => {
    renderHook(() => useTimeZoneCookieSync());

    expect(document.cookie).toContain("hermes_tz=Asia%2FJakarta");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("refreshes once when the page was rendered in another zone", () => {
    renderHook(() => useTimeZoneCookieSync("UTC"));
    renderHook(() => useTimeZoneCookieSync("UTC"));

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("does not refresh when the rendered zone already matches", () => {
    renderHook(() => useTimeZoneCookieSync("Asia/Jakarta"));

    expect(refreshMock).not.toHaveBeenCalled();
  });
});
