/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRemoveStepHandler } from "./route.post.config";

describe("createRemoveStepHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const removeHandler = createRemoveStepHandler({
      getSession: async () => null,
      db: {} as never,
    });
    const result = await removeHandler({
      body: { pipelineId: "p-1", stepId: "s-1" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns error when step not found", async () => {
    const db = {
      pipelineStep: {
        findFirst: vi.fn().mockResolvedValue(null),
        delete: vi.fn(),
      },
    };
    const removeHandler = createRemoveStepHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await removeHandler({
      body: { pipelineId: "p-1", stepId: "s-missing" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Step not found");
  });

  it("deletes step and renumbers remaining", async () => {
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      pipelineStep: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "s-1", pipelineId: "p-1", order: 1 }),
        delete: deleteMock,
        findMany: vi.fn().mockResolvedValue([{ id: "s-2", order: 2 }]),
        update: updateMock,
      },
    };
    const removeHandler = createRemoveStepHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await removeHandler({
      body: { pipelineId: "p-1", stepId: "s-1" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "s-1" } });
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "s-2" },
      data: { order: 0 },
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
      pipelineStep: {
        findFirst: vi.fn().mockResolvedValue({ id: "s-1", pipelineId: "p-1" }),
        delete: vi.fn().mockResolvedValue(undefined),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const customHandler = createRemoveStepHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await customHandler({
      body: { pipelineId: "p-1", stepId: "s-1" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(true);
  });
});
