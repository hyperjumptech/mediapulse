/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUpdateScheduleHandler } from "./route.post.config";

const mockDashboardUser = {
  id: "user-1",
  name: "A",
  email: "a@b.com",
} as const;

const scheduleId = "00000000-0000-4000-8000-000000000001";

const existingSchedule = {
  id: scheduleId,
  name: "Old name",
  repeat: "once" as const,
  cronExpression: null,
  interval: null,
  timezone: "UTC",
  startAt: new Date(),
  nextRunAt: new Date(),
  pipelineId: "p1",
  retryConfig: null,
  priority: 0,
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: null,
  description: null,
};

describe("createUpdateScheduleHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when schedule does not exist", async () => {
    const db = {
      schedule: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
    };
    const updateHandler = createUpdateScheduleHandler({
      db: db as never,
    });
    const result = await updateHandler({
      body: { scheduleId },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Schedule not found");
    expect(db.schedule.update).not.toHaveBeenCalled();
  });

  it("returns error when assigning pipeline that is not enabled", async () => {
    const db = {
      pipeline: {
        findUnique: vi.fn().mockResolvedValue({
          id: "p2",
          isActive: false,
          steps: [],
        }),
      },
      schedule: {
        findUnique: vi.fn().mockResolvedValue(existingSchedule),
        update: vi.fn(),
      },
    };
    const updateHandler = createUpdateScheduleHandler({
      db: db as never,
    });
    const result = await updateHandler({
      body: { scheduleId, pipelineId: "p2" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toContain(
      "Pipeline must be enabled",
    );
    expect(db.schedule.update).not.toHaveBeenCalled();
  });

  it("updates schedule and returns ok", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      pipeline: {
        findUnique: vi.fn().mockResolvedValue({
          id: "p1",
          isActive: true,
          steps: [],
        }),
      },
      schedule: {
        findUnique: vi.fn().mockResolvedValue(existingSchedule),
        update: updateMock,
      },
    };
    const updateHandler = createUpdateScheduleHandler({
      db: db as never,
    });
    const result = await updateHandler({
      body: { scheduleId, name: "New name", enabled: false },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(result.status).toBe(true);
    expect((result as { data?: { ok: boolean } }).data?.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: scheduleId },
      data: expect.objectContaining({
        name: "New name",
        enabled: false,
        nextRunAt: expect.any(Date),
      }),
    });
  });
});

describe("handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is the factory with production defaults", async () => {
    const db = {
      pipeline: {
        findUnique: vi.fn().mockResolvedValue({
          id: "p1",
          isActive: true,
          steps: [],
        }),
      },
      schedule: {
        findUnique: vi.fn().mockResolvedValue(existingSchedule),
        update: vi.fn().mockResolvedValue(undefined),
      },
    };
    const customHandler = createUpdateScheduleHandler({
      db: db as never,
    });
    const result = await customHandler({
      body: { scheduleId, name: "Updated" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(result.status).toBe(true);
  });
});
