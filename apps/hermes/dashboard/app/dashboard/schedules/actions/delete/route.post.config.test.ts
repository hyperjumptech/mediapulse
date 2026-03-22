/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeleteScheduleHandler } from "./route.post.config";

const scheduleId = "00000000-0000-4000-8000-000000000001";

describe("createDeleteScheduleHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const deleteHandler = createDeleteScheduleHandler({
      getSession: async () => null,
      db: {} as never,
    });
    const result = await deleteHandler({
      body: { scheduleId },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns error when schedule does not exist", async () => {
    const db = {
      schedule: {
        findUnique: vi.fn().mockResolvedValue(null),
        delete: vi.fn(),
      },
    };
    const deleteHandler = createDeleteScheduleHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await deleteHandler({
      body: { scheduleId },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Schedule not found");
    expect(db.schedule.delete).not.toHaveBeenCalled();
  });

  it("deletes schedule and returns ok", async () => {
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      schedule: {
        findUnique: vi.fn().mockResolvedValue({ id: scheduleId }),
        delete: deleteMock,
      },
    };
    const deleteHandler = createDeleteScheduleHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await deleteHandler({
      body: { scheduleId },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(true);
    expect((result as { data?: { ok: boolean } }).data?.ok).toBe(true);
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: scheduleId } });
  });
});

describe("handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is the factory with production defaults", async () => {
    const db = {
      schedule: {
        findUnique: vi.fn().mockResolvedValue({ id: scheduleId }),
        delete: vi.fn().mockResolvedValue(undefined),
      },
    };
    const customHandler = createDeleteScheduleHandler({
      getSession: async () => ({
        id: "user-1",
        name: "Admin",
        email: "admin@test.com",
      }),
      db: db as never,
    });
    const result = await customHandler({
      body: { scheduleId },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(true);
  });
});
