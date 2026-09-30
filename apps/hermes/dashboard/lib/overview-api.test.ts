/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  getOverviewForApi,
  type OverviewApiDependencies,
} from "@/lib/overview-api";

const now = new Date("2026-09-30T12:00:00.000Z");

const counts = (total: number) => ({
  total,
  succeeded: total,
  failed: 0,
  running: 0,
  cancelled: 0,
});

describe("getOverviewForApi", () => {
  it("reads the last two 24 hour windows, activity and the daily series", async () => {
    const dependencies: OverviewApiDependencies = {
      getStatusCounts: vi
        .fn()
        .mockResolvedValueOnce(counts(12))
        .mockResolvedValueOnce(counts(9)),
      getActivity: vi.fn().mockResolvedValue({ running: { rows: [] } }),
      getDailySeries: vi
        .fn()
        .mockResolvedValue([{ date: "2026-09-30", total: 12, failed: 0 }]),
    };

    const overview = await getOverviewForApi(
      { days: 7, timeZone: "Asia/Jakarta", now },
      dependencies,
    );

    expect(dependencies.getStatusCounts).toHaveBeenNthCalledWith(1, {
      since: new Date("2026-09-29T12:00:00.000Z"),
    });
    expect(dependencies.getStatusCounts).toHaveBeenNthCalledWith(2, {
      since: new Date("2026-09-28T12:00:00.000Z"),
      until: new Date("2026-09-29T12:00:00.000Z"),
    });
    expect(dependencies.getActivity).toHaveBeenCalledWith(
      new Date("2026-09-23T12:00:00.000Z"),
    );
    expect(dependencies.getDailySeries).toHaveBeenCalledWith({
      days: 7,
      timeZone: "Asia/Jakarta",
      now,
    });
    expect(overview).toMatchObject({
      last24Hours: { total: 12 },
      previous24Hours: { total: 9 },
      failedWindowDays: 7,
      daily: [{ date: "2026-09-30", total: 12 }],
    });
  });
});
