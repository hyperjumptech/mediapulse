/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAddStepHandler } from "./route.post.config";

const mockDashboardUser = {
  id: "user-1",
  name: "A",
  email: "a@b.com",
} as const;

describe("createAddStepHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when agent not in registry", async () => {
    const db = {
      agentRegistry: { findFirst: vi.fn().mockResolvedValue(null) },
      pipelineStep: {},
    };
    const addHandler = createAddStepHandler({
      db: db as never,
    });
    const result = await addHandler({
      body: { pipelineId: "p-1", agentId: "unknown", agentVersion: "1" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toContain("not found");
  });

  it("creates step and returns stepId", async () => {
    const db = {
      agentRegistry: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "ar1", agentId: "ag1", agentVersion: "1" }),
      },
      pipelineStep: {
        aggregate: vi.fn().mockResolvedValue({ _max: { order: 2 } }),
        create: vi.fn().mockResolvedValue({ id: "step-uuid" }),
      },
    };
    const addHandler = createAddStepHandler({
      db: db as never,
    });
    const result = await addHandler({
      body: { pipelineId: "p-1", agentId: "ag1", agentVersion: "1" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(db.pipelineStep.create).toHaveBeenCalledWith({
      data: {
        pipelineId: "p-1",
        agentId: "ag1",
        agentVersion: "1",
        order: 3,
        agentConfigId: null,
        agentContractId: null,
        input: {},
        config: {},
        createdById: mockDashboardUser.id,
      },
    });
    expect(result).toMatchObject({
      status: true,
      data: { stepId: "step-uuid" },
    });
  });
});

describe("handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is the factory with production defaults", async () => {
    const db = {
      agentRegistry: { findFirst: vi.fn().mockResolvedValue({ id: "ar1" }) },
      pipelineStep: {
        aggregate: vi.fn().mockResolvedValue({ _max: { order: null } }),
        create: vi.fn().mockResolvedValue({ id: "s1" }),
      },
    };
    const customHandler = createAddStepHandler({
      db: db as never,
    });
    const result = await customHandler({
      body: { pipelineId: "p-1", agentId: "ag1", agentVersion: "1" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);
    expect(result.status).toBe(true);
  });

  it("links a contract to the new step", async () => {
    const contractId = "00000000-0000-4000-8000-00000000c0de";
    const db = {
      agentRegistry: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "ar1", agentId: "ag1", agentVersion: "1" }),
      },
      agentContract: {
        findUnique: vi.fn().mockResolvedValue({ id: contractId }),
      },
      pipelineStep: {
        aggregate: vi.fn().mockResolvedValue({ _max: { order: 0 } }),
        create: vi.fn().mockResolvedValue({ id: "step-uuid" }),
      },
    };
    const addHandler = createAddStepHandler({ db: db as never });

    await addHandler({
      body: {
        pipelineId: "p-1",
        agentId: "ag1",
        agentVersion: "1",
        agentContractId: contractId,
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);

    expect(db.pipelineStep.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ agentContractId: contractId }),
    });
  });

  it("rejects a contract that does not exist", async () => {
    const db = {
      agentRegistry: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "ar1", agentId: "ag1", agentVersion: "1" }),
      },
      agentContract: { findUnique: vi.fn().mockResolvedValue(null) },
      pipelineStep: { create: vi.fn() },
    };
    const addHandler = createAddStepHandler({ db: db as never });

    const result = await addHandler({
      body: {
        pipelineId: "p-1",
        agentId: "ag1",
        agentVersion: "1",
        agentContractId: "00000000-0000-4000-8000-00000000c0de",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);

    expect(result.status).toBe(false);
    expect(db.pipelineStep.create).not.toHaveBeenCalled();
  });
});
