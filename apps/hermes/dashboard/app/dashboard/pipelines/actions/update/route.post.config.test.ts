/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUpdatePipelineHandler } from "./route.post.config";

const mockDashboardUser = {
  id: "user-1",
  name: "A",
  email: "a@b.com",
} as const;

vi.mock("@/lib/disable-schedules-for-pipeline", () => ({
  disableSchedulesForPipelineIfNotEnabled: vi.fn().mockResolvedValue(undefined),
}));

describe("createUpdatePipelineHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates pipeline and returns ok", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const db = { pipeline: { update: updateMock } };
    const updateHandler = createUpdatePipelineHandler({
      db: db as never,
    });
    const result = await updateHandler({
      body: { pipelineId: "p-1", name: "Updated", isActive: false },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "p-1" },
      data: { name: "Updated", isActive: false },
    });
    expect(result).toMatchObject({ status: true, data: { ok: true } });
  });

  it("syncs steps to DB when steps array provided", async () => {
    const pipelineUpdateMock = vi.fn().mockResolvedValue(undefined);
    const deleteManyMock = vi.fn().mockResolvedValue({ count: 2 });
    const createMock = vi.fn().mockResolvedValue({ id: "step-id" });
    const db = {
      pipeline: { update: pipelineUpdateMock },
      agentRegistry: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: "ar1",
            agentId: "ag1",
            agentVersion: "1",
          })
          .mockResolvedValueOnce({
            id: "ar2",
            agentId: "ag2",
            agentVersion: "2",
          }),
      },
      pipelineStep: {
        deleteMany: deleteManyMock,
        create: createMock,
      },
    };
    const updateHandler = createUpdatePipelineHandler({
      db: db as never,
    });
    const result = await updateHandler({
      body: {
        pipelineId: "p-1",
        steps: [
          { agentId: "ag1", agentVersion: "1" },
          { agentId: "ag2", agentVersion: "2" },
        ],
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(deleteManyMock).toHaveBeenCalledWith({
      where: { pipelineId: "p-1" },
    });
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(createMock).toHaveBeenNthCalledWith(1, {
      data: {
        pipelineId: "p-1",
        agentId: "ag1",
        agentVersion: "1",
        order: 0,
      },
    });
    expect(createMock).toHaveBeenNthCalledWith(2, {
      data: {
        pipelineId: "p-1",
        agentId: "ag2",
        agentVersion: "2",
        order: 1,
      },
    });
    expect(result).toMatchObject({ status: true, data: { ok: true } });
  });

  it("returns error when steps array contains agent not in registry", async () => {
    const db = {
      pipeline: { update: vi.fn().mockResolvedValue(undefined) },
      agentRegistry: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      pipelineStep: {
        deleteMany: vi.fn(),
        create: vi.fn(),
      },
    };
    const updateHandler = createUpdatePipelineHandler({
      db: db as never,
    });
    const result = await updateHandler({
      body: {
        pipelineId: "p-1",
        steps: [{ agentId: "unknown", agentVersion: "1" }],
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toContain("not found");
  });
});

describe("handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is the factory with production defaults", async () => {
    const db = { pipeline: { update: vi.fn().mockResolvedValue(undefined) } };
    const customHandler = createUpdatePipelineHandler({
      db: db as never,
    });
    const result = await customHandler({
      body: { pipelineId: "p-1", description: "Desc" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(result.status).toBe(true);
  });
});
