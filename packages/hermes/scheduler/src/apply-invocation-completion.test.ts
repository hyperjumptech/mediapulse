/** @vitest-environment node */
vi.mock("@hermes/orchestration-database", () => ({
  AgentJobExecutionStatus: {
    pending: "pending",
    running: "running",
    completed: "completed",
    failed: "failed",
    cancelled: "cancelled",
  },
  Prisma: {
    DbNull: Symbol("DbNull"),
  },
  ScheduleRunStatus: {
    pending: "pending",
    running: "running",
    succeeded: "succeeded",
    failed: "failed",
    partial: "partial",
    cancelled: "cancelled",
  },
  ScheduleStepRollupStatus: {
    pending: "pending",
    running: "running",
    success: "success",
    failed: "failed",
    partial: "partial",
    cancelled: "cancelled",
    skipped: "skipped",
  },
}));

import {
  AgentJobExecutionStatus,
  ScheduleRunStatus,
} from "@hermes/orchestration-database";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyInvocationCompletion,
  DEFAULT_COMPLETION_TRANSACTION_MAX_WAIT_MS,
  DEFAULT_COMPLETION_TRANSACTION_TIMEOUT_MS,
} from "./apply-invocation-completion";

describe("applyInvocationCompletion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("finalizes parent schedule execution when step rows are missing but all jobs are terminal", async () => {
    // Setup
    const scheduleExecutionId = "00000000-0000-4000-8000-000000000020";
    const pipelineStepId = "00000000-0000-4000-8000-000000000021";
    const jobId = "00000000-0000-4000-8000-000000000022";
    const scheduleExecutionUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const agentJobExecutionUpdate = vi.fn().mockResolvedValue(undefined);
    const scheduleExecutionUpdate = vi.fn().mockResolvedValue(undefined);
    const tx = {
      agentJobExecution: {
        update: agentJobExecutionUpdate,
        findMany: vi.fn().mockResolvedValue([
          {
            status: AgentJobExecutionStatus.failed,
            error: { message: "orphan" },
          },
        ]),
      },
      scheduleExecution: {
        update: scheduleExecutionUpdate,
        updateMany: scheduleExecutionUpdateMany,
      },
      scheduleStepExecution: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const db = {
      scheduleExecution: {
        findUnique: vi.fn().mockResolvedValue({
          id: scheduleExecutionId,
          runStatus: ScheduleRunStatus.pending,
          cancelledAt: null,
          effectiveExecutionConfig: null,
        }),
      },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const logger = { warn: vi.fn(), error: vi.fn() };

    // Act
    await applyInvocationCompletion(
      {
        jobId,
        scheduleExecutionId,
        pipelineStepId,
        terminal: {
          status: AgentJobExecutionStatus.failed,
          error: { message: "orphan" },
        },
      },
      { db: db as never, logger },
    );

    // Assert
    expect(scheduleExecutionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: scheduleExecutionId,
        runStatus: {
          in: [ScheduleRunStatus.pending, ScheduleRunStatus.running],
        },
      },
      data: {
        runStatus: ScheduleRunStatus.failed,
        succeededInvocationCount: 0,
        failedInvocationCount: 1,
      },
    });
  });

  type TransactionOptions = { timeout: number; maxWait: number };

  const buildCompletionDb = () => {
    const tx = {
      agentJobExecution: {
        update: vi.fn().mockResolvedValue(undefined),
        findMany: vi.fn().mockResolvedValue([
          {
            status: AgentJobExecutionStatus.failed,
            error: { message: "orphan" },
          },
        ]),
      },
      scheduleExecution: {
        update: vi.fn().mockResolvedValue(undefined),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      scheduleStepExecution: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };

    return {
      scheduleExecution: {
        findUnique: vi.fn().mockResolvedValue({
          id: "00000000-0000-4000-8000-000000000020",
          runStatus: ScheduleRunStatus.pending,
          cancelledAt: null,
          effectiveExecutionConfig: null,
        }),
      },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
  };

  const completionInput = {
    jobId: "00000000-0000-4000-8000-000000000022",
    scheduleExecutionId: "00000000-0000-4000-8000-000000000020",
    pipelineStepId: "00000000-0000-4000-8000-000000000021",
    terminal: {
      status: AgentJobExecutionStatus.failed,
      error: { message: "orphan" },
    },
  };

  it("gives the completion transaction a budget well past the 5s Prisma default", async () => {
    const db = buildCompletionDb();
    const logger = { warn: vi.fn(), error: vi.fn() };

    await applyInvocationCompletion(completionInput, {
      db: db as never,
      logger,
    });

    const [, options] = db.$transaction.mock.calls[0] as unknown as [
      unknown,
      TransactionOptions,
    ];

    expect(options).toEqual({
      timeout: DEFAULT_COMPLETION_TRANSACTION_TIMEOUT_MS,
      maxWait: DEFAULT_COMPLETION_TRANSACTION_MAX_WAIT_MS,
    });
    expect(DEFAULT_COMPLETION_TRANSACTION_TIMEOUT_MS).toBeGreaterThan(5_000);
  });

  it("lets the caller override the completion transaction budget", async () => {
    const db = buildCompletionDb();
    const logger = { warn: vi.fn(), error: vi.fn() };

    await applyInvocationCompletion(completionInput, {
      db: db as never,
      logger,
      transactionTimeoutMs: 45_000,
      transactionMaxWaitMs: 20_000,
    });

    const [, options] = db.$transaction.mock.calls[0] as unknown as [
      unknown,
      TransactionOptions,
    ];

    expect(options).toEqual({
      timeout: 45_000,
      maxWait: 20_000,
    });
  });

  it("returns early when parent execution is already terminal", async () => {
    // Setup
    const db = {
      scheduleExecution: {
        findUnique: vi.fn().mockResolvedValue({
          id: "00000000-0000-4000-8000-000000000030",
          runStatus: ScheduleRunStatus.succeeded,
          cancelledAt: null,
          effectiveExecutionConfig: null,
        }),
      },
      $transaction: vi.fn(),
    };

    // Act
    await applyInvocationCompletion(
      {
        jobId: "00000000-0000-4000-8000-000000000031",
        scheduleExecutionId: "00000000-0000-4000-8000-000000000030",
        pipelineStepId: "00000000-0000-4000-8000-000000000032",
        terminal: {
          status: AgentJobExecutionStatus.failed,
          error: { message: "late" },
        },
      },
      { db: db as never, logger: { warn: vi.fn(), error: vi.fn() } },
    );

    // Assert
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
