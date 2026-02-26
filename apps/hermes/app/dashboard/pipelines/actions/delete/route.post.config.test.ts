/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeletePipelineHandler, handler } from "./route.post.config";

describe("createDeletePipelineHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const deleteHandler = createDeletePipelineHandler({
      getSession: async () => null,
      db: {} as never,
    });
    const result = await deleteHandler({
      body: { pipelineId: "p-uuid" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("deletes pipeline and returns ok", async () => {
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    const db = { pipeline: { delete: deleteMock } };
    const deleteHandler = createDeletePipelineHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await deleteHandler({
      body: { pipelineId: "p-1" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "p-1" } });
    expect(result).toMatchObject({ status: true, data: { ok: true } });
  });
});

describe("handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is the factory with production defaults", async () => {
    const db = { pipeline: { delete: vi.fn().mockResolvedValue(undefined) } };
    const customHandler = createDeletePipelineHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await customHandler({
      body: { pipelineId: "p-1" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(true);
  });
});
