/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRunPipelineHandler,
  detailFromAgentErrorBody,
} from "./route.post.config";

const request = (body: { pipelineId: string }) =>
  ({
    body,
    params: {},
    headers: new Headers(),
    searchParams: {},
    user: undefined,
  }) as never;

describe("detailFromAgentErrorBody", () => {
  it("returns empty-body message for null or undefined", () => {
    expect(detailFromAgentErrorBody(null)).toBe(
      "Unknown error (empty response body)",
    );
    expect(detailFromAgentErrorBody(undefined)).toBe(
      "Unknown error (empty response body)",
    );
  });

  it("returns trimmed non-JSON string or truncates long strings", () => {
    expect(detailFromAgentErrorBody("  plain  ")).toBe("plain");
    expect(detailFromAgentErrorBody("   ")).toBe(
      "Unknown error (empty response body)",
    );
    const long = "x".repeat(400);
    expect(detailFromAgentErrorBody(long)).toBe(`${"x".repeat(300)}…`);
  });

  it("parses message from JSON string bodies", () => {
    expect(
      detailFromAgentErrorBody('{"message":"No data sources found"}'),
    ).toBe("No data sources found");
    expect(detailFromAgentErrorBody("{}")).toBe("{}");
  });

  it("parses message from object bodies", () => {
    expect(
      detailFromAgentErrorBody({
        message: "Skipped",
        agentId: "a",
      }),
    ).toBe("Skipped");
  });

  it("falls back when object has no usable message", () => {
    expect(detailFromAgentErrorBody({})).toBe("Unknown error (see agent logs)");
    expect(detailFromAgentErrorBody({ message: "" })).toBe(
      "Unknown error (see agent logs)",
    );
    expect(detailFromAgentErrorBody([])).toBe("Unknown error (see agent logs)");
  });
});

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

  it("returns error when getToken fails (e.g. AGENT_AUTH_API_URL/HERMES_INTERNAL_API_KEY not configured)", async () => {
    const handler = createRunPipelineHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      getToken: () =>
        Promise.reject(
          new Error(
            "AGENT_AUTH_API_URL and HERMES_INTERNAL_API_KEY are required",
          ),
        ),
      db: {
        pipeline: {
          findUnique: vi.fn().mockResolvedValue({ id: "p-1", name: "P" }),
        },
        pipelineStep: { findMany: vi.fn().mockResolvedValue([]) },
        agentRegistry: { findMany: vi.fn().mockResolvedValue([]) },
      } as never,
      fetchTickersForPipelineRun: async () => [],
    });
    const result = await handler(request({ pipelineId: "p-1" }));
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toContain(
      "AGENT_AUTH_API_URL and HERMES_INTERNAL_API_KEY",
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
      fetchTickersForPipelineRun: async () => [],
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
        variable: { findMany: vi.fn().mockResolvedValue([]) },
      } as never,
      fetchTickersForPipelineRun: async () => [],
    });
    const result = await handler(request({ pipelineId: "p-1" }));
    expect(result.status).toBe(true);
    expect(result).toMatchObject({ data: { ok: true, tickersRun: 0 } });
  });

  it("runs pipeline for each ticker and returns tickersRun", async () => {
    const postMock = vi.fn().mockResolvedValue({
      ok: true,
      statusCode: 200,
      body: {},
    });
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
        variable: { findMany: vi.fn().mockResolvedValue([]) },
      } as never,
      fetchTickersForPipelineRun: async () => [{ id: "t1" }],
    });
    const result = await handler(request({ pipelineId: "p-1" }));
    expect(result.status).toBe(true);
    expect(result).toMatchObject({ data: { ok: true, tickersRun: 1 } });
    expect(postMock).toHaveBeenCalledWith(
      "https://agent.example/run",
      expect.objectContaining({
        json: {
          input: { tickerId: "t1" },
          config: {},
        },
        headers: expect.objectContaining({
          Authorization: "Bearer minted-jwt",
        }),
        throwHttpErrors: false,
      }),
    );
  });

  it("returns error when an agent responds with a non-success HTTP status", async () => {
    const postMock = vi.fn().mockResolvedValue({
      ok: false,
      statusCode: 404,
      body: {
        agentId: "ag1",
        agentVersion: "1.0.0",
        skipped: true,
        message: "No data sources found for this ticker",
      },
    });
    const handler = createRunPipelineHandler({
      getSession: async () => ({ id: "user-1", name: "A", email: "a@b.com" }),
      getToken: async () => "jwt",
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
              input: { tickerId: "placeholder" },
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
        variable: { findMany: vi.fn().mockResolvedValue([]) },
      } as never,
      fetchTickersForPipelineRun: async () => [{ id: "ticker-uuid" }],
    });
    const result = await handler(request({ pipelineId: "p-1" }));
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toContain("ticker-uuid");
    expect((result as { message?: string }).message).toContain(
      "No data sources found for this ticker",
    );
    expect((result as { message?: string }).message).toContain("HTTP 404");
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
        variable: { findMany: vi.fn().mockResolvedValue([]) },
      } as never,
      fetchTickersForPipelineRun: async () => [{ id: "t1" }],
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
