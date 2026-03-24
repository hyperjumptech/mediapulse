/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCreateScheduleHandler } from "./route.post.config";

const mockDashboardUser = {
  id: "user-1",
  name: "A",
  email: "a@b.com",
} as const;

describe("createCreateScheduleHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when pipeline does not exist", async () => {
    const db = {
      pipeline: { findUnique: vi.fn().mockResolvedValue(null) },
      schedule: { create: vi.fn() },
    };
    const createHandler = createCreateScheduleHandler({
      db: db as never,
    });
    const result = await createHandler({
      body: {
        name: "Daily",
        repeat: "once",
        timezone: "UTC",
        pipelineId: "00000000-0000-4000-8000-000000000001",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Pipeline not found");
    expect(db.schedule.create).not.toHaveBeenCalled();
  });

  it("returns error when pipeline is not enabled (disabled)", async () => {
    const pipelineId = "00000000-0000-4000-8000-000000000002";
    const db = {
      pipeline: {
        findUnique: vi.fn().mockResolvedValue({
          id: pipelineId,
          isActive: false,
          steps: [],
        }),
      },
      schedule: { create: vi.fn() },
    };
    const createHandler = createCreateScheduleHandler({
      db: db as never,
    });
    const result = await createHandler({
      body: {
        name: "Daily",
        repeat: "once",
        timezone: "UTC",
        pipelineId,
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toContain(
      "Pipeline must be enabled",
    );
    expect(db.schedule.create).not.toHaveBeenCalled();
  });

  it("creates schedule and returns id", async () => {
    const pipelineId = "00000000-0000-4000-8000-000000000002";
    const scheduleId = "00000000-0000-4000-8000-000000000003";
    const db = {
      pipeline: {
        findUnique: vi.fn().mockResolvedValue({
          id: pipelineId,
          isActive: true,
          steps: [],
        }),
      },
      schedule: {
        create: vi.fn().mockResolvedValue({
          id: scheduleId,
          name: "Daily",
          pipelineId,
        }),
      },
    };
    const createHandler = createCreateScheduleHandler({
      db: db as never,
    });
    const result = await createHandler({
      body: {
        name: "Daily",
        repeat: "once",
        timezone: "America/New_York",
        pipelineId,
        startAt: null,
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(result.status).toBe(true);
    expect((result as { data?: { id: string } }).data?.id).toBe(scheduleId);
    expect(db.schedule.create).toHaveBeenCalledTimes(1);
    const createCall = (db.schedule.create as ReturnType<typeof vi.fn>).mock
      .calls[0];
    const createData = createCall?.[0]?.data;
    expect(createData).toBeDefined();
    expect(createData!.name).toBe("Daily");
    expect(createData.repeat).toBe("once");
    expect(createData.pipelineId).toBe(pipelineId);
    expect(createData.nextRunAt).toBeNull();
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
      schedule: { create: vi.fn().mockResolvedValue({ id: "s1" }) },
    };
    const customHandler = createCreateScheduleHandler({
      db: db as never,
    });
    const result = await customHandler({
      body: {
        name: "Test",
        repeat: "repeating",
        cronExpression: "0 6 * * *",
        timezone: "UTC",
        pipelineId: "p1",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(result.status).toBe(true);
  });
});
