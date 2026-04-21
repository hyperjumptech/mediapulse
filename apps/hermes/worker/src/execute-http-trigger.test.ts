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
  return {
    planPipelineInvocations: vi.fn(),
    mergeExecutionConfig,
    diagnosticFromCaughtError,
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
          create: vi.fn().mockResolvedValue(undefined),
        },
        agentJobExecution: {
          create: vi.fn().mockResolvedValue(undefined),
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
});
