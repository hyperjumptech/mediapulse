/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeletePipelineHandler } from "./route.post.config";

const mockDashboardUser = {
  id: "user-1",
  name: "A",
  email: "a@b.com",
} as const;

describe("createDeletePipelineHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes pipeline and returns ok", async () => {
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      pipeline: { delete: deleteMock },
      pipelineStep: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const deleteHandler = createDeletePipelineHandler({
      db: db as never,
    });
    const result = await deleteHandler({
      body: { pipelineId: "p-1" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "p-1" } });
    expect(result).toMatchObject({ status: true, data: { ok: true } });
  });

  it("refuses to delete a pipeline that other pipelines run as a step", async () => {
    const deleteMock = vi.fn();
    const findMany = vi
      .fn()
      .mockResolvedValue([
        { pipeline: { name: "Day One" } },
        { pipeline: { name: "Day One" } },
        { pipeline: { name: "Weekly" } },
      ]);
    const db = {
      pipeline: { delete: deleteMock },
      pipelineStep: { findMany },
    };
    const deleteHandler = createDeletePipelineHandler({ db: db as never });

    const result = await deleteHandler({
      body: { pipelineId: "p-1" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);

    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe(
      "Used as a step in: Day One, Weekly. Remove those steps first.",
    );
    expect(findMany).toHaveBeenCalledWith({
      where: { targetPipelineId: "p-1" },
      select: { pipeline: { select: { name: true } } },
    });
    expect(deleteMock).not.toHaveBeenCalled();
  });
});

describe("handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is the factory with production defaults", async () => {
    const db = {
      pipeline: { delete: vi.fn().mockResolvedValue(undefined) },
      pipelineStep: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const customHandler = createDeletePipelineHandler({
      db: db as never,
    });
    const result = await customHandler({
      body: { pipelineId: "p-1" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(result.status).toBe(true);
  });
});
