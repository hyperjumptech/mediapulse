/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCreateScheduleHandler } from "./route.post.config";

describe("createCreateScheduleHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const createHandler = createCreateScheduleHandler({
      getSession: async () => null,
      db: {} as never,
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
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns error when pipeline does not exist", async () => {
    const db = {
      pipeline: { findUnique: vi.fn().mockResolvedValue(null) },
      schedule: { create: vi.fn() },
    };
    const createHandler = createCreateScheduleHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
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
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Pipeline not found");
    expect(db.schedule.create).not.toHaveBeenCalled();
  });

  it("creates schedule and returns id", async () => {
    const pipelineId = "00000000-0000-4000-8000-000000000002";
    const scheduleId = "00000000-0000-4000-8000-000000000003";
    const db = {
      pipeline: {
        findUnique: vi.fn().mockResolvedValue({ id: pipelineId, steps: [] }),
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
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
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
      user: undefined,
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
        findUnique: vi.fn().mockResolvedValue({ id: "p1", steps: [] }),
      },
      schedule: { create: vi.fn().mockResolvedValue({ id: "s1" }) },
    };
    const customHandler = createCreateScheduleHandler({
      getSession: async () => ({
        id: "user-1",
        name: "Admin",
        email: "admin@test.com",
      }),
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
      user: undefined,
    } as never);
    expect(result.status).toBe(true);
  });
});
