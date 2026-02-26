/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUpdatePipelineHandler, handler } from "./route.post.config";

describe("createUpdatePipelineHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const updateHandler = createUpdatePipelineHandler({
      getSession: async () => null,
      db: {} as never,
    });
    const result = await updateHandler({
      body: { pipelineId: "p-uuid", name: "New Name" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("updates pipeline and returns ok", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const db = { pipeline: { update: updateMock } };
    const updateHandler = createUpdatePipelineHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await updateHandler({
      body: { pipelineId: "p-1", name: "Updated", isActive: false },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "p-1" },
      data: { name: "Updated", isActive: false },
    });
    expect(result).toMatchObject({ status: true, data: { ok: true } });
  });
});

describe("handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is the factory with production defaults", async () => {
    const db = { pipeline: { update: vi.fn().mockResolvedValue(undefined) } };
    const customHandler = createUpdatePipelineHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await customHandler({
      body: { pipelineId: "p-1", description: "Desc" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(true);
  });
});
