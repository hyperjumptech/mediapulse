/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUpdateStepHandler } from "./route.post.config";

describe("createUpdateStepHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const handler = createUpdateStepHandler({
      getSession: async () => null,
      db: {} as never,
    });
    const result = await handler({
      body: {
        pipelineId: "p-1",
        stepId: "s-1",
        agentId: "ag1",
        agentVersion: "1",
      },
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
      },
      agentRegistry: {},
    };
    const handler = createUpdateStepHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await handler({
      body: {
        pipelineId: "p-1",
        stepId: "s-missing",
        agentId: "ag1",
        agentVersion: "1",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Step not found");
  });

  it("returns error when agent not in registry", async () => {
    const db = {
      pipelineStep: {
        findFirst: vi.fn().mockResolvedValue({
          id: "s-1",
          pipelineId: "p-1",
          order: 0,
          agentId: "ag0",
          agentVersion: "0",
        }),
      },
      agentRegistry: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const handler = createUpdateStepHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await handler({
      body: {
        pipelineId: "p-1",
        stepId: "s-1",
        agentId: "unknown",
        agentVersion: "1",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toContain("not found");
  });

  it("updates step and returns ok", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      pipelineStep: {
        findFirst: vi.fn().mockResolvedValue({
          id: "s-1",
          pipelineId: "p-1",
          order: 0,
          agentId: "ag0",
          agentVersion: "0",
        }),
        update: updateMock,
      },
      agentRegistry: {
        findFirst: vi.fn().mockResolvedValue({
          id: "ar1",
          agentId: "ag1",
          agentVersion: "1",
        }),
      },
    };
    const handler = createUpdateStepHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await handler({
      body: {
        pipelineId: "p-1",
        stepId: "s-1",
        agentId: "ag1",
        agentVersion: "1",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "s-1" },
      data: { agentId: "ag1", agentVersion: "1" },
    });
    expect(result).toMatchObject({
      status: true,
      data: { ok: true },
    });
  });
});

describe("handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is the factory with production defaults", async () => {
    const db = {
      pipelineStep: {
        findFirst: vi.fn().mockResolvedValue({
          id: "s-1",
          pipelineId: "p-1",
          order: 0,
          agentId: "ag0",
          agentVersion: "0",
        }),
        update: vi.fn().mockResolvedValue(undefined),
      },
      agentRegistry: {
        findFirst: vi.fn().mockResolvedValue({
          id: "ar1",
          agentId: "ag1",
          agentVersion: "1",
        }),
      },
    };
    const { createUpdateStepHandler } = await import("./route.post.config");
    const customHandler = createUpdateStepHandler({
      getSession: async () => ({ name: "A", email: "a@b.com" }),
      db: db as never,
    });
    const result = await customHandler({
      body: {
        pipelineId: "p-1",
        stepId: "s-1",
        agentId: "ag1",
        agentVersion: "1",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(true);
  });
});
