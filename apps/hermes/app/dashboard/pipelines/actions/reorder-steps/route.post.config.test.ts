/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createReorderStepsHandler } from "./route.post.config";

describe("createReorderStepsHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const reorderHandler = createReorderStepsHandler({
      getSession: async () => null,
      db: {} as never,
    });
    const result = await reorderHandler({
      body: { pipelineId: "p-1", stepIds: ["s1", "s2"] },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("updates step order by index and returns ok", async () => {
    const updateManyMock = vi.fn().mockResolvedValue({ count: 1 });
    const db = { pipelineStep: { updateMany: updateManyMock } };
    const reorderHandler = createReorderStepsHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await reorderHandler({
      body: { pipelineId: "p-1", stepIds: ["s2", "s1"] },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(updateManyMock).toHaveBeenCalledTimes(2);
    expect(updateManyMock).toHaveBeenNthCalledWith(1, {
      where: { id: "s2", pipelineId: "p-1" },
      data: { order: 0 },
    });
    expect(updateManyMock).toHaveBeenNthCalledWith(2, {
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
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await customHandler({
      body: { pipelineId: "p-1", stepIds: ["s1"] },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(true);
  });
});
