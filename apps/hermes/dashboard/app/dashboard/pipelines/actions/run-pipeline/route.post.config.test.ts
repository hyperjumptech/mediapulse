/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRunPipelineHandler } from "./route.post.config";

const request = (body: { pipelineId: string }) =>
  ({
    body,
    params: {},
    headers: new Headers(),
    searchParams: {},
    user: undefined,
  }) as never;

describe("createRunPipelineHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const handler = createRunPipelineHandler({
      getSession: async () => null,
      db: {} as never,
    });
    const result = await handler(request({ pipelineId: "p-uuid" }));
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns error when getToken fails (e.g. AGENT_AUTH_API_URL/AGENT_API_KEY not configured)", async () => {
    const handler = createRunPipelineHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      getToken: () =>
        Promise.reject(
          new Error("AGENT_AUTH_API_URL and AGENT_API_KEY are required"),
        ),
      db: {
        pipeline: {
          findUnique: vi.fn().mockResolvedValue({ id: "p-1", name: "P" }),
        },
        pipelineStep: { findMany: vi.fn().mockResolvedValue([]) },
        agentRegistry: { findMany: vi.fn().mockResolvedValue([]) },
      } as never,
      mediapulseDb: {
        ticker: { findMany: vi.fn().mockResolvedValue([]) },
      } as never,
    });
    const result = await handler(request({ pipelineId: "p-1" }));
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toContain(
      "AGENT_AUTH_API_URL and AGENT_API_KEY",
    );
  });

  it("returns error when pipeline not found", async () => {
    const handler = createRunPipelineHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      getToken: async () => "jwt",
      db: {
        pipeline: { findUnique: vi.fn().mockResolvedValue(null) },
        pipelineStep: { findMany: vi.fn() },
        agentRegistry: { findMany: vi.fn() },
      } as never,
      mediapulseDb: { ticker: { findMany: vi.fn() } } as never,
    });
    const result = await handler(request({ pipelineId: "p-missing" }));
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Pipeline not found");
  });

  it("returns success with tickersRun 0 when no tickers", async () => {
    const handler = createRunPipelineHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      getToken: async () => "jwt",
      db: {
        pipeline: {
          findUnique: vi.fn().mockResolvedValue({ id: "p-1", name: "P" }),
        },
        pipelineStep: { findMany: vi.fn().mockResolvedValue([]) },
        agentRegistry: { findMany: vi.fn().mockResolvedValue([]) },
      } as never,
      mediapulseDb: {
        ticker: { findMany: vi.fn().mockResolvedValue([]) },
      } as never,
    });
    const result = await handler(request({ pipelineId: "p-1" }));
    expect(result.status).toBe(true);
    expect(result).toMatchObject({ data: { ok: true, tickersRun: 0 } });
  });

  it("runs pipeline for each ticker and returns tickersRun", async () => {
    const postMock = vi.fn().mockResolvedValue(undefined);
    const handler = createRunPipelineHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      getToken: async () => "minted-jwt",
      post: postMock as never,
      db: {
        pipeline: {
          findUnique: vi.fn().mockResolvedValue({ id: "p-1", name: "P" }),
        },
        pipelineStep: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "s1",
              agentId: "ag1",
              agentVersion: "1.0.0",
              order: 1,
              agentConfigId: null,
              input: { tickerId: "t1" },
              config: {},
            },
          ]),
        },
        agentRegistry: {
          findFirst: vi.fn().mockResolvedValue({
            agentId: "ag1",
            agentVersion: "1.0.0",
            isActive: true,
            inputSchema: {
              type: "object",
              required: ["tickerId"],
              properties: { tickerId: { type: "string" } },
            },
            configSchema: null,
          }),
          findMany: vi.fn().mockResolvedValue([
            {
              agentId: "ag1",
              endpoint: { url: "https://agent.example/run", method: "POST" },
            },
          ]),
        },
      } as never,
      mediapulseDb: {
        ticker: {
          findMany: vi.fn().mockResolvedValue([{ id: "t1", symbol: "X" }]),
        },
      } as never,
    });
    const result = await handler(request({ pipelineId: "p-1" }));
    expect(result.status).toBe(true);
    expect(result).toMatchObject({ data: { ok: true, tickersRun: 1 } });
    expect(postMock).toHaveBeenCalledWith(
      "https://agent.example/run",
      expect.objectContaining({
        json: { tickerId: "t1" },
        headers: expect.objectContaining({
          Authorization: "Bearer minted-jwt",
        }),
      }),
    );
  });

  it("returns error when pipeline validation fails", async () => {
    // Setup
    const handler = createRunPipelineHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      getToken: async () => "jwt",
      post: vi.fn() as never,
      db: {
        pipeline: {
          findUnique: vi.fn().mockResolvedValue({ id: "p-1", name: "P" }),
        },
        pipelineStep: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "s1",
              agentId: "ag1",
              agentVersion: "1.0.0",
              order: 0,
              agentConfigId: null,
              input: { tickerId: "" },
              config: {},
            },
          ]),
        },
        agentRegistry: {
          findFirst: vi.fn().mockResolvedValue({
            agentId: "ag1",
            agentVersion: "1.0.0",
            isActive: true,
            inputSchema: {
              type: "object",
              required: ["tickerId"],
              properties: { tickerId: { type: "string" } },
            },
            configSchema: null,
          }),
          findMany: vi.fn().mockResolvedValue([]),
        },
      } as never,
      mediapulseDb: {
        ticker: {
          findMany: vi.fn().mockResolvedValue([{ id: "t1", symbol: "X" }]),
        },
      } as never,
    });

    // Act
    const result = await handler(request({ pipelineId: "p-1" }));

    // Assert
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toContain(
      "Pipeline is invalid",
    );
  });
});
