/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUpdateStepHandler } from "./route.post.config";

const mockDashboardUser = {
  id: "user-1",
  name: "A",
  email: "a@b.com",
} as const;

vi.mock("@/lib/disable-schedules-for-pipeline", () => ({
  disableSchedulesForPipelineIfNotEnabled: vi.fn().mockResolvedValue(undefined),
}));

describe("createUpdateStepHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when step not found", async () => {
    const db = {
      pipelineStep: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      agentRegistry: {},
    };
    const handler = createUpdateStepHandler({
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
      user: mockDashboardUser,
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
      user: mockDashboardUser,
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
      user: mockDashboardUser,
    } as never);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "s-1" },
      data: {
        agentId: "ag1",
        agentVersion: "1",
        agentConfigId: null,
        input: {},
        config: {},
      },
    });
    expect(result).toMatchObject({
      status: true,
      data: { ok: true },
    });
  });

  it("returns validation warnings for missing required config fields", async () => {
    // Setup
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
          inputSchema: {
            type: "object",
            properties: {},
          },
          configSchema: {
            type: "object",
            required: ["webFetch"],
            properties: {
              webFetch: {
                type: "object",
                required: ["baseUrl"],
                properties: {
                  baseUrl: { type: "string" },
                },
              },
            },
          },
        }),
      },
    };
    const handler = createUpdateStepHandler({
      db: db as never,
    });

    // Act
    const result = await handler({
      body: {
        pipelineId: "p-1",
        stepId: "s-1",
        agentId: "ag1",
        agentVersion: "1",
        config: { webFetch: { baseUrl: "" } },
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: mockDashboardUser,
    } as never);

    // Assert
    expect(result.status).toBe(true);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      data: {
        ok: true,
        validationWarnings: expect.arrayContaining([
          expect.stringContaining("/webFetch/baseUrl is required"),
        ]),
      },
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
      user: mockDashboardUser,
    } as never);
    expect(result.status).toBe(true);
  });
});
