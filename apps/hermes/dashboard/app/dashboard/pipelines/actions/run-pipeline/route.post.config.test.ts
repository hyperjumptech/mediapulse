/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { HERMES_ENQUEUE_CORRELATION_METADATA_KEY } from "@hermes/scheduler/enqueue-diagnostics-correlation";

let mockXRequestId: string | null | undefined;

vi.mock("next/headers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/headers")>();
  return {
    ...actual,
    headers: vi.fn(async () => ({
      get: (name: string) => {
        if (name.toLowerCase() !== "x-request-id") return null;
        return mockXRequestId ?? null;
      },
    })),
  };
});

import {
  agentHttpBodyToRawString,
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

describe("agentHttpBodyToRawString", () => {
  it("stringifies objects and detects empty strings", () => {
    expect(agentHttpBodyToRawString({ a: 1 })).toEqual({
      raw: '{"a":1}',
      isEmpty: false,
    });
    expect(agentHttpBodyToRawString("")).toEqual({ raw: "", isEmpty: true });
    expect(agentHttpBodyToRawString(null)).toEqual({ raw: "", isEmpty: true });
  });
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

  it("adds a gateway hint for 502/503/504 when the body is empty", () => {
    expect(detailFromAgentErrorBody(null, { statusCode: 502 })).toContain(
      "Bad gateway or upstream error",
    );
    expect(detailFromAgentErrorBody(undefined, { statusCode: 503 })).toContain(
      "reverse proxy",
    );
    expect(detailFromAgentErrorBody("", { statusCode: 504 })).toContain(
      "load balancer",
    );
  });

  it("does not replace a concrete message for 502", () => {
    expect(
      detailFromAgentErrorBody(
        { message: "Rate limited" },
        { statusCode: 502 },
      ),
    ).toBe("Rate limited");
  });
});

describe("createRunPipelineHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockXRequestId = undefined;
  });

  it("returns error when pipeline is missing", async () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
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
    expect(logSpy).toHaveBeenCalledWith(
      "[hermes-dashboard:run-pipeline]",
      "Pipeline not found",
      expect.objectContaining({
        phase: "load-pipeline",
        pipelineId: "missing",
      }),
    );
    logSpy.mockRestore();
  });

  it("returns error and logs when an unexpected error is thrown", async () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = createRunPipelineHandler({
      getToken: async () => "jwt",
      db: {
        ...createExecutionPersistenceStubs(),
        pipeline: {
          findUnique: vi.fn().mockRejectedValue(new Error("db down")),
        },
      } as never,
    });
    const result = await handler(request({ pipelineId: "p-1" }));
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe(
      "Run pipeline failed: db down",
    );
    expect(logSpy).toHaveBeenCalledWith(
      "[hermes-dashboard:run-pipeline]",
      "Unexpected error while running pipeline",
      expect.objectContaining({
        phase: "unhandled",
        pipelineId: "p-1",
      }),
      expect.any(Error),
    );
    logSpy.mockRestore();
  });

  it("returns failed run with 0 invocations when planning yields no jobs", async () => {
    const stubs = createExecutionPersistenceStubs();
    const handler = createRunPipelineHandler({
      getToken: async () => "jwt",
      expandStepInputs: async () => [],
      db: {
        ...stubs,
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
    const createCall = stubs.manualPipelineExecution.create.mock
      .calls[0]?.[0] as {
      data: {
        errors?: Array<{ phase?: string; message?: string }>;
        metadata?: Record<string, unknown>;
      };
    };
    expect(createCall?.data.errors).toBeDefined();
    expect(createCall.data.errors?.[0]?.phase).toBe("planning");
    expect(createCall.data.errors?.[0]?.message).toMatch(
      /No invocations planned/i,
    );
    expect(createCall.data.metadata).toEqual(
      expect.objectContaining({
        source: "dashboard",
        initiatedByUserId: "u1",
        initiatedByUserEmail: "a@b.com",
        [HERMES_ENQUEUE_CORRELATION_METADATA_KEY]: expect.objectContaining({
          requestId: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
          ),
        }),
      }),
    );
  });

  it("stores X-Request-Id on manual execution metadata when header is set", async () => {
    mockXRequestId = "dashboard-run-req-7";
    const stubs = createExecutionPersistenceStubs();
    const handler = createRunPipelineHandler({
      getToken: async () => "jwt",
      expandStepInputs: async () => [],
      db: {
        ...stubs,
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

    await handler(request({ pipelineId: "p-1" }));
    const createCall = stubs.manualPipelineExecution.create.mock
      .calls[0]?.[0] as { data: { metadata?: Record<string, unknown> } };
    expect(
      createCall.data.metadata?.[HERMES_ENQUEUE_CORRELATION_METADATA_KEY],
    ).toEqual({ requestId: "dashboard-run-req-7" });
  });

  it("runs one planned invocation and returns invocationsRun", async () => {
    const postMock = vi.fn().mockResolvedValue({
      ok: true,
      statusCode: 200,
      body: {
        schemaVersion: 1,
        status: "success",
        details: { ok: true },
      },
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
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
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
    expect(logSpy).toHaveBeenCalledWith(
      "[hermes-dashboard:run-pipeline]",
      "Agent HTTP response was not OK",
      expect.objectContaining({
        phase: "agent-http",
        pipelineId: "p-1",
        detail: "bad input",
        statusCode: 400,
      }),
    );
    logSpy.mockRestore();
  });

  it("treats HTTP 200 with envelope status failure as a failed invocation", async () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const postMock = vi.fn().mockResolvedValue({
      ok: true,
      statusCode: 200,
      body: {
        schemaVersion: 1,
        status: "failure",
        message: "No rows collected",
      },
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
    expect(logSpy).toHaveBeenCalledWith(
      "[hermes-dashboard:run-pipeline]",
      "Agent returned HTTP 200 with envelope status failure",
      expect.objectContaining({
        phase: "agent-semantic",
        pipelineId: "p-1",
        detail: "No rows collected",
      }),
    );
    logSpy.mockRestore();
  });
});
