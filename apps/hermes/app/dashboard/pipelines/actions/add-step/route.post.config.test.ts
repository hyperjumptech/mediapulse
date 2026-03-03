/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAddStepHandler } from "./route.post.config";

describe("createAddStepHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const addHandler = createAddStepHandler({
      getSession: async () => null,
      db: {} as never,
    });
    const result = await addHandler({
      body: { pipelineId: "p-1", agentId: "ag1", agentVersion: "1" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns error when agent not in registry", async () => {
    const db = {
      agentRegistry: { findFirst: vi.fn().mockResolvedValue(null) },
      pipelineStep: {},
    };
    const addHandler = createAddStepHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await addHandler({
      body: { pipelineId: "p-1", agentId: "unknown", agentVersion: "1" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
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
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await addHandler({
      body: { pipelineId: "p-1", agentId: "ag1", agentVersion: "1" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(db.pipelineStep.create).toHaveBeenCalledWith({
      data: { pipelineId: "p-1", agentId: "ag1", agentVersion: "1", order: 3 },
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
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await customHandler({
      body: { pipelineId: "p-1", agentId: "ag1", agentVersion: "1" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(true);
  });
});
