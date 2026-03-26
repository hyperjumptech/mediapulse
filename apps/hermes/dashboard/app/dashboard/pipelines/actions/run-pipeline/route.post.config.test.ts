/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AgentJobExecutionStatus,
  ScheduleRunStatus,
} from "@hermes/orchestration-database";

import { createRunPipelineHandler } from "./route.post.config";

vi.mock("@/lib/validate-pipeline", () => ({
  validatePipeline: vi.fn().mockResolvedValue({ valid: true, warnings: [] }),
}));

vi.mock("@/lib/expand-step-inputs-for-manual-pipeline", () => ({
  createExpandStepInputsForManualPipelineRun:
    () => async (context: { input: Record<string, unknown> }) => [
      context.input,
    ],
}));

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
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  $transaction: vi.fn(async (callback: (tx: unknown) => Promise<void>) =>
    callback({
      manualPipelineStepExecution: {
        create: vi.fn().mockResolvedValue(undefined),
      },
      agentJobExecution: {
        create: vi.fn().mockResolvedValue(undefined),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      manualPipelineExecution: {
        update: vi.fn().mockResolvedValue(undefined),
      },
    }),
  ),
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

describe("createRunPipelineHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when pipeline is missing", async () => {
    // Setup
    const handler = createRunPipelineHandler({
      queue: {
        addJobs: vi.fn().mockResolvedValue([]),
        editJob: vi.fn().mockResolvedValue(undefined),
      },
      db: {
        ...createExecutionPersistenceStubs(),
        pipeline: { findUnique: vi.fn().mockResolvedValue(null) },
      } as never,
    });

    // Act
    const result = await handler(request({ pipelineId: "missing" }));

    // Assert
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Pipeline not found");
  });

  it("returns failed run with 0 queued invocations when planning yields no jobs", async () => {
    // Setup
    const handler = createRunPipelineHandler({
      expandStepInputs: async () => [],
      queue: {
        addJobs: vi.fn().mockResolvedValue([]),
        editJob: vi.fn().mockResolvedValue(undefined),
      },
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

    // Act
    const result = await handler(request({ pipelineId: "p-1" }));

    // Assert
    expect(result.status).toBe(true);
    expect(result).toMatchObject({
      data: {
        ok: true,
        invocationsQueued: 0,
        runStatus: "failed",
      },
    });
  });

  it("enqueues one invocation and returns pending execution metadata", async () => {
    // Setup
    const queue = {
      addJobs: vi.fn().mockResolvedValue([101]),
      editJob: vi.fn().mockResolvedValue(undefined),
    };
    const handler = createRunPipelineHandler({
      expandStepInputs: async (ctx) => [ctx.input],
      queue,
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

    // Act
    const result = await handler(request({ pipelineId: "p-1" }));

    // Assert
    expect(result.status).toBe(true);
    expect(result).toMatchObject({
      data: {
        ok: true,
        invocationsQueued: 1,
        runStatus: "pending",
      },
    });
    expect(queue.addJobs).toHaveBeenCalledTimes(1);
    expect(queue.editJob).toHaveBeenCalledWith(
      101,
      expect.objectContaining({
        payload: expect.objectContaining({ hermesDataQueueJobId: 101 }),
      }),
    );
  });

  it("returns error when queue enqueue fails", async () => {
    // Setup
    const queue = {
      addJobs: vi.fn().mockRejectedValue(new Error("queue down")),
      editJob: vi.fn().mockResolvedValue(undefined),
    };
    const manualExecutionUpdate = vi.fn().mockResolvedValue(undefined);
    const agentJobUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const handler = createRunPipelineHandler({
      expandStepInputs: async (ctx) => [ctx.input],
      queue,
      db: {
        ...createExecutionPersistenceStubs(),
        $transaction: vi.fn(async () => {
          await manualExecutionUpdate({
            data: { runStatus: ScheduleRunStatus.failed },
          });
          await agentJobUpdateMany({
            data: { status: AgentJobExecutionStatus.failed },
          });
        }),
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

    // Act
    const result = await handler(request({ pipelineId: "p-1" }));

    // Assert
    expect(queue.addJobs).toHaveBeenCalled();
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe(
      "Failed to enqueue manual execution jobs. Please retry.",
    );
  });
});
