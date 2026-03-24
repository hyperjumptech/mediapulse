/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createReorderStepsHandler } from "./route.post.config";

const mockDashboardUser = {
  id: "user-1",
  name: "A",
  email: "a@b.com",
} as const;

vi.mock("@/lib/disable-schedules-for-pipeline", () => ({
  disableSchedulesForPipelineIfNotEnabled: vi.fn().mockResolvedValue(undefined),
}));

describe("createReorderStepsHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates step order by index and returns ok", async () => {
    const updateManyMock = vi.fn().mockResolvedValue({ count: 1 });
    const db = { pipelineStep: { updateMany: updateManyMock } };
    const reorderHandler = createReorderStepsHandler({
      db: db as never,
    });
    const result = await reorderHandler({
      body: { pipelineId: "p-1", stepIds: ["s2", "s1"] },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    // Two-phase update to avoid unique constraint on (pipelineId, order)
    expect(updateManyMock).toHaveBeenCalledTimes(4);
    // Phase 1: temporary orders
    expect(updateManyMock).toHaveBeenNthCalledWith(1, {
      where: { id: "s2", pipelineId: "p-1" },
      data: { order: 10000 },
    });
    expect(updateManyMock).toHaveBeenNthCalledWith(2, {
      where: { id: "s1", pipelineId: "p-1" },
      data: { order: 10001 },
    });
    // Phase 2: final orders
    expect(updateManyMock).toHaveBeenNthCalledWith(3, {
      where: { id: "s2", pipelineId: "p-1" },
      data: { order: 0 },
    });
    expect(updateManyMock).toHaveBeenNthCalledWith(4, {
      where: { id: "s1", pipelineId: "p-1" },
      data: { order: 1 },
    });
    expect(result).toMatchObject({ status: true, data: { ok: true } });
  });
});

describe("handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is the factory with production defaults", async () => {
    const db = {
      pipelineStep: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const customHandler = createReorderStepsHandler({
      db: db as never,
    });
    const result = await customHandler({
      body: { pipelineId: "p-1", stepIds: ["s1"] },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(result.status).toBe(true);
  });
});
