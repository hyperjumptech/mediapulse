/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@hermes/orchestration-database", () => ({
  AgentJobExecutionStatus: {
    pending: "pending",
    running: "running",
    completed: "completed",
    failed: "failed",
  },
  Prisma: {},
  ScheduleEnqueueStatus: {
    success: "success",
    partial: "partial",
    failed: "failed",
  },
  ScheduleRunStatus: {
    pending: "pending",
    running: "running",
    succeeded: "succeeded",
    partial: "partial",
    failed: "failed",
  },
  ScheduleStepRollupStatus: {
    pending: "pending",
    running: "running",
    success: "success",
    partial: "partial",
    failed: "failed",
    skipped: "skipped",
    cancelled: "cancelled",
  },
}));

/**
 * Mock `@hermes/scheduler` without `importOriginal` so Vitest never loads the full
 * package entry (which pulls `@hermes/orchestration-database` / env validation).
 * Real `mergeExecutionConfig` and `diagnosticFromCaughtError` come from source modules
 * that only depend on zod / plain TS.
 */
vi.mock("@hermes/scheduler", async () => {
  const { mergeExecutionConfig } =
    await import("../../../../packages/hermes/scheduler/src/execution-config");
  const { diagnosticFromCaughtError } =
    await import("../../../../packages/hermes/scheduler/src/enqueue-diagnostics");
  const { redactSecretValues } =
    await import("../../../../packages/hermes/scheduler/src/redact-secret-values");
  const { parseRunParams } =
    await import("../../../../packages/hermes/scheduler/src/run-params");
  return {
    planPipelineInvocations: vi.fn(),
    mergeExecutionConfig,
    diagnosticFromCaughtError,
    parseRunParams,
    redactSecretValues,
  };
});

import * as scheduler from "@hermes/scheduler";
import { executeHttpTrigger } from "./execute-http-trigger";

describe("executeHttpTrigger", () => {
  beforeEach(() => {
    vi.mocked(scheduler.planPipelineInvocations).mockResolvedValue({
      waveList: [
        [
          {
            pipelineStepId: "step-1",
            agentId: "agent-a",
            agentVersion: "1.0.0",
            endpointUrl: "https://agent.example/run",
            input: {},
            config: {},
          },
        ],
      ],
      errors: [],
      secretValues: [],
    });
  });

  it("persists enqueue diagnostics when enqueueAgentInvocations throws", async () => {
    const httpTriggerExecutionUpdate = vi.fn().mockResolvedValue(undefined);
    const agentJobExecutionUpdate = vi.fn().mockResolvedValue(undefined);
    const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        httpTriggerExecution: {
          update: vi.fn().mockResolvedValue(undefined),
        },
        httpTriggerStepExecution: {
          createMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        agentJobExecution: {
          createMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      };
      await fn(tx);
    });

    const boom = new Error("dataqueue unavailable");
    boom.stack = "Error: dataqueue unavailable\n  at addJobs.ts:2:2";

    const db = {
      httpTriggerExecution: {
        findUnique: vi.fn().mockResolvedValue({
          id: "exec-1",
          httpTrigger: {
            id: "trig-1",
            pipeline: {
              id: "pipe-1",
              domainIntegrationId: "di-1",
              executionConfig: null,
              timeout: null,
              steps: [
                {
                  id: "step-1",
                  order: 0,
                  agentId: "agent-a",
                  agentVersion: "1.0.0",
                  pipelineId: "pipe-1",
                  agentConfigId: null,
                  input: {},
                  config: {},
                  agentConfig: null,
                },
              ],
            },
          },
        }),
        update: httpTriggerExecutionUpdate,
      },
      $transaction,
      agentJobExecution: {
        update: agentJobExecutionUpdate,
      },
    };

    await executeHttpTrigger("exec-1", {
      db: db as never,
      enqueueAgentInvocations: vi.fn().mockRejectedValue(boom),
    });

    expect(httpTriggerExecutionUpdate).toHaveBeenCalled();
    const updateArg = httpTriggerExecutionUpdate.mock.calls[0]?.[0] as {
      data: {
        enqueueStatus: string;
        errors?: Array<{ phase?: string; exception?: { stack?: string } }>;
      };
    };
    expect(updateArg.data.enqueueStatus).toBe("failed");
    const errs = updateArg.data.errors ?? [];
    expect(
      errs.some(
        (e) =>
          e.phase === "enqueue" &&
          e.exception?.stack?.includes("addJobs.ts") === true,
      ),
    ).toBe(true);
    expect(agentJobExecutionUpdate).toHaveBeenCalled();
  });

  it("uses pipeline.timeout for invoke_agent payload when set", async () => {
    const enqueueAgentInvocations = vi.fn().mockResolvedValue(undefined);
    const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        httpTriggerExecution: {
          update: vi.fn().mockResolvedValue(undefined),
        },
        httpTriggerStepExecution: {
          createMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        agentJobExecution: {
          createMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      };
      await fn(tx);
    });
    const httpTriggerExecutionUpdate = vi.fn().mockResolvedValue(undefined);
    const db = {
      httpTriggerExecution: {
        findUnique: vi.fn().mockResolvedValue({
          id: "exec-1",
          httpTrigger: {
            id: "trig-1",
            pipeline: {
              id: "pipe-1",
              domainIntegrationId: "di-1",
              executionConfig: null,
              timeout: 90_000,
              steps: [
                {
                  id: "step-1",
                  order: 0,
                  agentId: "agent-a",
                  agentVersion: "1.0.0",
                  pipelineId: "pipe-1",
                  agentConfigId: null,
                  input: {},
                  config: {},
                  agentConfig: null,
                },
              ],
            },
          },
        }),
        update: httpTriggerExecutionUpdate,
      },
      $transaction,
    };

    await executeHttpTrigger("exec-1", {
      db: db as never,
      enqueueAgentInvocations,
      defaultTimeoutMs: 300_000,
    });

    expect(enqueueAgentInvocations).toHaveBeenCalledTimes(1);
    const [items] = enqueueAgentInvocations.mock.calls[0] as [
      Array<{ payload: { timeoutMs: number } }>,
    ];
    expect(items[0]?.payload.timeoutMs).toBe(90_000);
  });

  const createDbWithRunParams = (runParams: unknown) => {
    const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        httpTriggerExecution: {
          update: vi.fn().mockResolvedValue(undefined),
        },
        httpTriggerStepExecution: {
          createMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        agentJobExecution: {
          createMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      };
      await fn(tx);
    });
    const httpTriggerExecutionUpdate = vi.fn().mockResolvedValue(undefined);
    const db = {
      httpTriggerExecution: {
        findUnique: vi.fn().mockResolvedValue({
          id: "exec-1",
          runParams,
          httpTrigger: {
            id: "trig-1",
            pipeline: {
              id: "pipe-1",
              domainIntegrationId: "di-1",
              executionConfig: null,
              timeout: null,
              steps: [
                {
                  id: "step-1",
                  order: 0,
                  agentId: "agent-a",
                  agentVersion: "1.0.0",
                  pipelineId: "pipe-1",
                  agentConfigId: null,
                  input: { itemId: "{{params.itemId}}" },
                  config: {},
                  agentConfig: null,
                },
              ],
            },
          },
        }),
        update: httpTriggerExecutionUpdate,
      },
      $transaction,
    };

    return { db, httpTriggerExecutionUpdate };
  };

  it("passes stored run parameters to planning", async () => {
    const enqueueAgentInvocations = vi.fn().mockResolvedValue(undefined);
    const { db } = createDbWithRunParams({ itemId: "abc" });

    await executeHttpTrigger("exec-1", {
      db: db as never,
      enqueueAgentInvocations,
    });

    expect(scheduler.planPipelineInvocations).toHaveBeenCalledWith(
      expect.objectContaining({ runParams: { itemId: "abc" } }),
    );
  });

  it("fails the execution without planning when stored run parameters are invalid", async () => {
    vi.mocked(scheduler.planPipelineInvocations).mockClear();
    const enqueueAgentInvocations = vi.fn().mockResolvedValue(undefined);
    const { db, httpTriggerExecutionUpdate } = createDbWithRunParams({
      itemId: { nested: true },
    });

    await executeHttpTrigger("exec-1", {
      db: db as never,
      enqueueAgentInvocations,
    });

    expect(scheduler.planPipelineInvocations).not.toHaveBeenCalled();
    expect(enqueueAgentInvocations).not.toHaveBeenCalled();
    expect(httpTriggerExecutionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          runStatus: "failed",
          errors: [
            expect.objectContaining({
              message: expect.stringContaining("Invalid run parameters"),
            }),
          ],
        }),
      }),
    );
  });
});
