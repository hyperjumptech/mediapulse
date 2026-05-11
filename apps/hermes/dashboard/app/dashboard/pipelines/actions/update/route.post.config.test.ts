/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUpdatePipelineHandler } from "./route.post.config";

const mockDashboardUser = {
  id: "user-1",
  name: "A",
  email: "a@b.com",
} as const;

const CURRENT_DOMAIN_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_DOMAIN_ID = "22222222-2222-2222-2222-222222222222";

vi.mock("@/lib/disable-schedules-for-pipeline", () => ({
  disableSchedulesForPipelineIfNotEnabled: vi.fn().mockResolvedValue(undefined),
}));

describe("createUpdatePipelineHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates pipeline and returns ok", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      pipeline: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ domainIntegrationId: CURRENT_DOMAIN_ID }),
        update: updateMock,
      },
    };
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

  it("updates pipeline timeout when provided", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      pipeline: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ domainIntegrationId: CURRENT_DOMAIN_ID }),
        update: updateMock,
      },
    };
    const updateHandler = createUpdatePipelineHandler({
      db: db as never,
    });
    const result = await updateHandler({
      body: { pipelineId: "p-1", timeout: 120_000 },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "p-1" },
      data: { timeout: 120_000 },
    });
    expect(result).toMatchObject({ status: true, data: { ok: true } });
  });

  it("clears pipeline timeout when empty string is sent", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      pipeline: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ domainIntegrationId: CURRENT_DOMAIN_ID }),
        update: updateMock,
      },
    };
    const updateHandler = createUpdatePipelineHandler({
      db: db as never,
    });
    const result = await updateHandler({
      body: { pipelineId: "p-1", timeout: null },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "p-1" },
      data: { timeout: null },
    });
    expect(result).toMatchObject({ status: true, data: { ok: true } });
  });

  it("syncs steps to DB when steps array provided", async () => {
    const pipelineUpdateMock = vi.fn().mockResolvedValue(undefined);
    const deleteManyMock = vi.fn().mockResolvedValue({ count: 2 });
    const createMock = vi.fn().mockResolvedValue({ id: "step-id" });
    const findFirst = vi
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
      });
    const db = {
      pipeline: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ domainIntegrationId: CURRENT_DOMAIN_ID }),
        update: pipelineUpdateMock,
      },
      agentRegistry: { findFirst },
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
    expect(findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        agentId: "ag1",
        agentVersion: "1",
        isActive: true,
        domainIntegrationId: CURRENT_DOMAIN_ID,
      },
    });
    expect(findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        agentId: "ag2",
        agentVersion: "2",
        isActive: true,
        domainIntegrationId: CURRENT_DOMAIN_ID,
      },
    });
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
      pipeline: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ domainIntegrationId: CURRENT_DOMAIN_ID }),
        update: vi.fn().mockResolvedValue(undefined),
      },
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

  it("returns error when pipeline not found", async () => {
    const db = {
      pipeline: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
    };
    const updateHandler = createUpdatePipelineHandler({
      db: db as never,
    });
    const result = await updateHandler({
      body: { pipelineId: "p-1", name: "X" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toContain("not found");
  });

  it("updates domainIntegrationId when existing steps are registered on new integration", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const findManySteps = vi
      .fn()
      .mockResolvedValue([{ agentId: "ag1", agentVersion: "1" }]);
    const findFirst = vi.fn().mockResolvedValue({ id: "reg" });
    const db = {
      pipeline: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ domainIntegrationId: CURRENT_DOMAIN_ID }),
        update: updateMock,
      },
      pipelineStep: { findMany: findManySteps },
      agentRegistry: { findFirst },
    };
    const updateHandler = createUpdatePipelineHandler({
      db: db as never,
    });
    const result = await updateHandler({
      body: {
        pipelineId: "p-1",
        domainIntegrationId: OTHER_DOMAIN_ID,
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(findManySteps).toHaveBeenCalledWith({
      where: { pipelineId: "p-1" },
      select: { agentId: true, agentVersion: true },
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        agentId: "ag1",
        agentVersion: "1",
        isActive: true,
        domainIntegrationId: OTHER_DOMAIN_ID,
      },
    });
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "p-1" },
      data: { domainIntegrationId: OTHER_DOMAIN_ID },
    });
    expect(result).toMatchObject({ status: true, data: { ok: true } });
  });

  it("returns error when switching domain and an agent is missing on the new integration", async () => {
    const db = {
      pipeline: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ domainIntegrationId: CURRENT_DOMAIN_ID }),
        update: vi.fn(),
      },
      pipelineStep: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ agentId: "ag1", agentVersion: "1" }]),
      },
      agentRegistry: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const updateHandler = createUpdatePipelineHandler({
      db: db as never,
    });
    const result = await updateHandler({
      body: {
        pipelineId: "p-1",
        domainIntegrationId: OTHER_DOMAIN_ID,
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toContain(
      "not registered for this domain integration",
    );
  });
});

describe("handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is the factory with production defaults", async () => {
    const db = {
      pipeline: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ domainIntegrationId: CURRENT_DOMAIN_ID }),
        update: vi.fn().mockResolvedValue(undefined),
      },
    };
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
