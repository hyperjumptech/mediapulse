/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createRunPipelineHandler,
  detailFromAgentErrorBody,
} from "./route.post.config";

const mockDashboardUser = {
  id: "u1",
  name: "A",
  email: "a@b.com",
} as const;

const request = (body: { pipelineId: string }) =>
  ({
    body,
    params: {},
    headers: new Headers(),
    searchParams: {},
    user: mockDashboardUser,
  }) as never;

const createExecutionPersistenceStubs = () => ({
  manualPipelineExecution: {
    create: vi.fn().mockResolvedValue({ id: "manual-exec-1" }),
    update: vi.fn().mockResolvedValue(undefined),
  },
  manualPipelineStepExecution: {
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  },
  agentJobExecution: {
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  },
});

const createPipelineWithSteps = () => ({
  id: "p-1",
  name: "P",
  domainIntegrationId: "di-1",
  executionConfig: null,
  steps: [
    {
      id: "s1",
      order: 1,
      agentId: "ag1",
      agentVersion: "1.0.0",
      agentConfigId: null,
      input: { id: "single-id" },
      config: {},
      agentConfig: null,
    },
  ],
});

describe("detailFromAgentErrorBody", () => {
  it("handles nullish and plain string values", () => {
    expect(detailFromAgentErrorBody(null)).toBe(
      "Unknown error (empty response body)",
    );
    expect(detailFromAgentErrorBody(undefined)).toBe(
      "Unknown error (empty response body)",
    );
    expect(detailFromAgentErrorBody("  plain  ")).toBe("plain");
  });

  it("prefers message field from objects/JSON strings", () => {
    expect(detailFromAgentErrorBody('{"message":"No data"}')).toBe("No data");
    expect(detailFromAgentErrorBody({ message: "No data" })).toBe("No data");
  });
});

describe("createRunPipelineHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when pipeline is missing", async () => {
    const handler = createRunPipelineHandler({
      getToken: async () => "jwt",
      db: {
        ...createExecutionPersistenceStubs(),
        pipeline: { findUnique: vi.fn().mockResolvedValue(null) },
      } as never,
    });
    const result = await handler(request({ pipelineId: "missing" }));
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Pipeline not found");
  });

  it("returns failed run with 0 invocations when planning yields no jobs", async () => {
    const handler = createRunPipelineHandler({
      getToken: async () => "jwt",
      expandStepInputs: async () => [],
      db: {
        ...createExecutionPersistenceStubs(),
        pipeline: {
          findUnique: vi.fn().mockResolvedValue(createPipelineWithSteps()),
        },
        variable: { findMany: vi.fn().mockResolvedValue([]) },
        agentRegistry: {
          findFirst: vi.fn().mockResolvedValue({
            agentId: "ag1",
            agentVersion: "1.0.0",
            endpoint: { url: "https://agent.example/run", method: "POST" },
            inputSchema: null,
            configSchema: null,
            isActive: true,
          }),
          findMany: vi.fn().mockResolvedValue([
            {
              agentId: "ag1",
              agentVersion: "1.0.0",
              endpoint: { url: "https://agent.example/run", method: "POST" },
              inputSchema: null,
              configSchema: null,
              isActive: true,
            },
          ]),
        },
        agentConfig: { findFirst: vi.fn().mockResolvedValue(null) },
      } as never,
    });

    const result = await handler(request({ pipelineId: "p-1" }));
    expect(result.status).toBe(true);
    expect(result).toMatchObject({
      data: {
        ok: true,
        invocationsRun: 0,
        runStatus: "failed",
      },
    });
  });

  it("runs one planned invocation and returns invocationsRun", async () => {
    const postMock = vi.fn().mockResolvedValue({
      ok: true,
      statusCode: 200,
      body: {},
    });
    const handler = createRunPipelineHandler({
      getToken: async () => "jwt",
      expandStepInputs: async (ctx) => [ctx.input],
      post: postMock as never,
      db: {
        ...createExecutionPersistenceStubs(),
        pipeline: {
          findUnique: vi.fn().mockResolvedValue(createPipelineWithSteps()),
        },
        variable: { findMany: vi.fn().mockResolvedValue([]) },
        agentRegistry: {
          findFirst: vi.fn().mockResolvedValue({
            agentId: "ag1",
            agentVersion: "1.0.0",
            endpoint: { url: "https://agent.example/run", method: "POST" },
            inputSchema: null,
            configSchema: null,
            isActive: true,
          }),
          findMany: vi.fn().mockResolvedValue([
            {
              agentId: "ag1",
              agentVersion: "1.0.0",
              endpoint: { url: "https://agent.example/run", method: "POST" },
              inputSchema: null,
              configSchema: null,
              isActive: true,
            },
          ]),
        },
        agentConfig: { findFirst: vi.fn().mockResolvedValue(null) },
      } as never,
    });

    const result = await handler(request({ pipelineId: "p-1" }));
    expect(result.status).toBe(true);
    expect(result).toMatchObject({
      data: {
        ok: true,
        invocationsRun: 1,
        runStatus: "succeeded",
        failedInvocationCount: 0,
      },
    });
    expect(postMock).toHaveBeenCalledWith(
      "https://agent.example/run",
      expect.objectContaining({
        json: { input: { id: "single-id" }, config: {} },
        throwHttpErrors: false,
      }),
    );
  });

  it("returns success with failedInvocationCount when invocation fails", async () => {
    const postMock = vi.fn().mockResolvedValue({
      ok: false,
      statusCode: 400,
      body: { message: "bad input" },
    });
    const handler = createRunPipelineHandler({
      getToken: async () => "jwt",
      expandStepInputs: async (ctx) => [ctx.input],
      post: postMock as never,
      db: {
        ...createExecutionPersistenceStubs(),
        pipeline: {
          findUnique: vi.fn().mockResolvedValue(createPipelineWithSteps()),
        },
        variable: { findMany: vi.fn().mockResolvedValue([]) },
        agentRegistry: {
          findFirst: vi.fn().mockResolvedValue({
            agentId: "ag1",
            agentVersion: "1.0.0",
            endpoint: { url: "https://agent.example/run", method: "POST" },
            inputSchema: null,
            configSchema: null,
            isActive: true,
          }),
          findMany: vi.fn().mockResolvedValue([
            {
              agentId: "ag1",
              agentVersion: "1.0.0",
              endpoint: { url: "https://agent.example/run", method: "POST" },
              inputSchema: null,
              configSchema: null,
              isActive: true,
            },
          ]),
        },
        agentConfig: { findFirst: vi.fn().mockResolvedValue(null) },
      } as never,
    });

    const result = await handler(request({ pipelineId: "p-1" }));
    expect(result.status).toBe(true);
    expect(result).toMatchObject({
      data: {
        ok: true,
        invocationsRun: 1,
        runStatus: "failed",
        failedInvocationCount: 1,
      },
    });
  });
});
