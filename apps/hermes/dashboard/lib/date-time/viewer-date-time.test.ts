import { afterEach, describe, expect, it, vi } from "vitest";

const cookieValueMock = vi.fn<() => string | undefined>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => {
      const value = cookieValueMock();

      return value === undefined ? undefined : { value };
    },
  }),
}));

vi.mock("@hermes/env", () => ({
  env: { HERMES_DASHBOARD_DEFAULT_TIME_ZONE: "Asia/Jakarta" },
}));

import {
  formatViewerDateTime,
  getViewerDateTimeContext,
} from "./viewer-date-time";

describe("getViewerDateTimeContext", () => {
  afterEach(() => {
    cookieValueMock.mockReset();
  });

  it("uses the time zone the browser reported", async () => {
    cookieValueMock.mockReturnValue("America/New_York");

    const context = await getViewerDateTimeContext();

    expect(context.timeZone).toBe("America/New_York");
  });

  it("falls back to the configured zone when the cookie is missing or invalid", async () => {
    cookieValueMock.mockReturnValue("Mars/Olympus");

    const context = await getViewerDateTimeContext();

    expect(context.timeZone).toBe("Asia/Jakarta");
  });
});

describe("formatViewerDateTime", () => {
  it("formats with the viewer zone", async () => {
    cookieValueMock.mockReturnValue("UTC");

    const label = await formatViewerDateTime("2025-01-02T03:04:00.000Z");

    expect(label).toBe("Jan 2, 2025, 03:04");
  });
});
