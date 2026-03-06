/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDueSchedules, type GetDueSchedulesDb } from "./get-due-schedules";

describe("getDueSchedules", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls schedule.findMany with enabled and nextRunAt lte now", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = {
      schedule: { findMany },
    } as unknown as GetDueSchedulesDb;

    await getDueSchedules(db);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        enabled: true,
        nextRunAt: { lte: expect.any(Date) },
      },
      include: {
        pipeline: { include: { steps: { orderBy: { order: "asc" } } } },
      },
    });
  });

  it("returns schedules returned by findMany", async () => {
    const schedules = [
      {
        id: "s1",
        name: "Test",
        pipelineId: "p1",
        pipeline: { id: "p1", steps: [] },
      },
    ];
    const db = {
      schedule: { findMany: vi.fn().mockResolvedValue(schedules) },
    } as unknown as GetDueSchedulesDb;

    const result = await getDueSchedules(db);

    expect(result).toEqual(schedules);
  });
});
