/** @vitest-environment node */
import {
  AgentJobExecutionStatus,
  ScheduleStepRollupStatus,
} from "@hermes/orchestration-database";
import { applyInvocationCompletion } from "@hermes/scheduler";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PENDING_ORPHAN_THRESHOLD_MINUTES,
  reconcileOrphanedPendingExecutions,
} from "./reconcile-orphaned-pending";

vi.mock("@hermes/orchestration-database", () => ({
  AgentJobExecutionStatus: {
    pending: "pending",
    running: "running",
    completed: "completed",
    failed: "failed",
    cancelled: "cancelled",
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

vi.mock("@hermes/scheduler", () => ({
  applyInvocationCompletion: vi.fn().mockResolvedValue(undefined),
  parseEffectiveExecutionConfig: vi.fn().mockReturnValue({
    schemaVersion: 1,
    stepRollupPolicy: "strict",
    stepOrder: "sequential",
    continueSequentialAfterPartial: false,
  }),
}));

const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockFindUnique = vi.fn();
const mockFindFirst = vi.fn();

const makeDb = () =>
  ({
    agentJobExecution: { findMany: mockFindMany, update: mockUpdate },
    pipelineStep: { findUnique: mockFindUnique, findFirst: mockFindFirst },
    scheduleStepExecution: { findUnique: mockFindUnique },
    httpTriggerStepExecution: { findUnique: mockFindUnique },
    manualPipelineStepExecution: { findUnique: mockFindUnique },
    scheduleExecution: { findUnique: mockFindUnique },
    httpTriggerExecution: { findUnique: mockFindUnique },
    manualPipelineExecution: { findUnique: mockFindUnique },
  }) as unknown as Parameters<
    typeof reconcileOrphanedPendingExecutions
  >[0]["db"];

const makePool = (rows: object[] = [], rowCount = 0) => ({
  query: vi.fn().mockResolvedValue({ rows, rowCount }),
});

const makeLogger = () => ({
  warn: vi.fn(),
  error: vi.fn(),
});

const makePendingRow = (
  overrides: Partial<{
    jobId: string;
    scheduleExecutionId: string | null;
    httpTriggerExecutionId: string | null;
    manualExecutionId: string | null;
    pipelineStepId: string | null;
    pipelineId: string | null;
    enqueuedAt: Date;
  }> = {},
) => ({
  jobId: "job-1",
  scheduleExecutionId: "se-1",
  httpTriggerExecutionId: null,
  manualExecutionId: null,
  pipelineStepId: "step-2",
  pipelineId: "pipeline-1",
  enqueuedAt: new Date(Date.now() - 60 * 60 * 1_000),
  ...overrides,
});

describe("reconcileOrphanedPendingExecutions", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockUpdate.mockReset();
    mockFindUnique.mockReset();
    mockFindFirst.mockReset();
    vi.mocked(applyInvocationCompletion).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 0,0 when no pending rows exist", async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await reconcileOrphanedPendingExecutions({
      db: makeDb(),
      dataQueuePool: makePool(),
      logger: makeLogger(),
    });

    expect(result).toEqual({ reEnqueued: 0, settled: 0 });
    expect(applyInvocationCompletion).not.toHaveBeenCalled();
  });

  it("uses DEFAULT_PENDING_ORPHAN_THRESHOLD_MINUTES (35) when threshold is omitted", async () => {
    const before = Date.now();
    mockFindMany.mockResolvedValue([]);

    await reconcileOrphanedPendingExecutions({
      db: makeDb(),
      dataQueuePool: makePool(),
      logger: makeLogger(),
    });

    const where = mockFindMany.mock.calls[0]![0].where as {
      enqueuedAt: { lt: Date };
    };
    const cutoff = where.enqueuedAt.lt.getTime();
    expect(cutoff).toBeLessThanOrEqual(
      before - DEFAULT_PENDING_ORPHAN_THRESHOLD_MINUTES * 60 * 1_000 + 100,
    );
  });

  it("settles as failed when DataQueue job is absent", async () => {
    const row = makePendingRow();
    mockFindMany.mockResolvedValue([row]);
    const pool = makePool([]); // empty rows = job not found

    const result = await reconcileOrphanedPendingExecutions({
      db: makeDb(),
      dataQueuePool: pool,
      logger: makeLogger(),
    });

    expect(result).toEqual({ reEnqueued: 0, settled: 1 });
    expect(applyInvocationCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        scheduleExecutionId: "se-1",
        terminal: expect.objectContaining({
          status: AgentJobExecutionStatus.failed,
        }),
      }),
      expect.any(Object),
    );
  });

  it("skips rows whose DataQueue job is still pending", async () => {
    const row = makePendingRow();
    mockFindMany.mockResolvedValue([row]);
    const pool = makePool([
      {
        id: 99,
        status: "pending",
        pending_reason: null,
        next_attempt_at: null,
      },
    ]);

    const result = await reconcileOrphanedPendingExecutions({
      db: makeDb(),
      dataQueuePool: pool,
      logger: makeLogger(),
    });

    expect(result).toEqual({ reEnqueued: 0, settled: 0 });
    expect(applyInvocationCompletion).not.toHaveBeenCalled();
  });

  it("skips rows whose DataQueue job is failed-with-retries pending", async () => {
    const row = makePendingRow();
    mockFindMany.mockResolvedValue([row]);
    const pool = makePool([
      {
        id: 99,
        status: "failed",
        pending_reason: null,
        next_attempt_at: new Date(Date.now() + 60_000),
      },
    ]);

    const result = await reconcileOrphanedPendingExecutions({
      db: makeDb(),
      dataQueuePool: pool,
      logger: makeLogger(),
    });

    expect(result).toEqual({ reEnqueued: 0, settled: 0 });
    expect(applyInvocationCompletion).not.toHaveBeenCalled();
  });

  it("settles as failed when DataQueue job is terminal-failed (no retries)", async () => {
    const row = makePendingRow();
    mockFindMany.mockResolvedValue([row]);
    const pool = makePool([
      { id: 99, status: "failed", pending_reason: null, next_attempt_at: null },
    ]);

    const result = await reconcileOrphanedPendingExecutions({
      db: makeDb(),
      dataQueuePool: pool,
      logger: makeLogger(),
    });

    expect(result).toEqual({ reEnqueued: 0, settled: 1 });
    expect(applyInvocationCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        terminal: expect.objectContaining({
          status: AgentJobExecutionStatus.failed,
        }),
      }),
      expect.any(Object),
    );
  });

  it("settles as cancelled when DataQueue job is user-cancelled (no cascade)", async () => {
    const row = makePendingRow();
    mockFindMany.mockResolvedValue([row]);
    const pool = makePool([
      {
        id: 99,
        status: "cancelled",
        pending_reason: null,
        next_attempt_at: null,
      },
    ]);

    const result = await reconcileOrphanedPendingExecutions({
      db: makeDb(),
      dataQueuePool: pool,
      logger: makeLogger(),
    });

    expect(result).toEqual({ reEnqueued: 0, settled: 1 });
    expect(applyInvocationCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        terminal: expect.objectContaining({
          status: AgentJobExecutionStatus.cancelled,
        }),
      }),
      expect.any(Object),
    );
  });

  describe("cascade-cancelled jobs", () => {
    const cascadePendingReason = JSON.stringify({
      rootJobId: 42,
      dependencyCascade: true,
    });

    it("re-enqueues cascade-cancelled job when predecessor step succeeded", async () => {
      const row = makePendingRow();
      mockFindMany.mockResolvedValue([row]);

      const poolQuery = vi
        .fn()
        // First call: look up job
        .mockResolvedValueOnce({
          rows: [
            {
              id: 99,
              status: "cancelled",
              pending_reason: cascadePendingReason,
              next_attempt_at: null,
            },
          ],
        })
        // Second call: UPDATE to reset to pending
        .mockResolvedValueOnce({ rows: [{ id: 99 }] });

      const pool = { query: poolQuery };

      // pipelineStep.findUnique for current step order
      mockFindUnique
        .mockResolvedValueOnce({ order: 2 }) // thisStep
        // predecessorStep found via findFirst
        // scheduleStepExecution for predecessor
        .mockResolvedValueOnce({
          rollupStatus: ScheduleStepRollupStatus.success,
        });

      // pipelineStep.findFirst for predecessor
      mockFindFirst.mockResolvedValueOnce({ id: "step-1" });

      const result = await reconcileOrphanedPendingExecutions({
        db: makeDb(),
        dataQueuePool: pool,
        logger: makeLogger(),
      });

      expect(result).toEqual({ reEnqueued: 1, settled: 0 });
      expect(applyInvocationCompletion).not.toHaveBeenCalled();

      // Verify the UPDATE SQL cleared dependency links
      const updateCall = poolQuery.mock.calls[1];
      expect(updateCall![0]).toContain("depends_on_job_ids = '{}'");
      expect(updateCall![1]).toEqual([99]);
    });

    it("settles as cancelled when predecessor step failed", async () => {
      const row = makePendingRow();
      mockFindMany.mockResolvedValue([row]);

      const poolQuery = vi.fn().mockResolvedValueOnce({
        rows: [
          {
            id: 99,
            status: "cancelled",
            pending_reason: cascadePendingReason,
            next_attempt_at: null,
          },
        ],
      });
      const pool = { query: poolQuery };

      mockFindUnique
        .mockResolvedValueOnce({ order: 2 }) // thisStep
        .mockResolvedValueOnce({
          rollupStatus: ScheduleStepRollupStatus.failed,
        }); // predecessor step execution

      mockFindFirst.mockResolvedValueOnce({ id: "step-1" });

      const result = await reconcileOrphanedPendingExecutions({
        db: makeDb(),
        dataQueuePool: pool,
        logger: makeLogger(),
      });

      expect(result).toEqual({ reEnqueued: 0, settled: 1 });
      expect(applyInvocationCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: "job-1",
          terminal: expect.objectContaining({
            status: AgentJobExecutionStatus.cancelled,
          }),
        }),
        expect.any(Object),
      );
    });

    it("settles as cancelled when predecessor step rollup is still pending (upstream not settled)", async () => {
      const row = makePendingRow();
      mockFindMany.mockResolvedValue([row]);

      const poolQuery = vi.fn().mockResolvedValueOnce({
        rows: [
          {
            id: 99,
            status: "cancelled",
            pending_reason: cascadePendingReason,
            next_attempt_at: null,
          },
        ],
      });
      const pool = { query: poolQuery };

      mockFindUnique
        .mockResolvedValueOnce({ order: 2 }) // thisStep
        .mockResolvedValueOnce({
          rollupStatus: ScheduleStepRollupStatus.pending,
        }); // predecessor still pending

      mockFindFirst.mockResolvedValueOnce({ id: "step-1" });

      const result = await reconcileOrphanedPendingExecutions({
        db: makeDb(),
        dataQueuePool: pool,
        logger: makeLogger(),
      });

      expect(result).toEqual({ reEnqueued: 0, settled: 1 });
    });

    it("settles as cancelled when this is the first wave (no predecessor step)", async () => {
      const row = makePendingRow();
      mockFindMany.mockResolvedValue([row]);

      const poolQuery = vi.fn().mockResolvedValueOnce({
        rows: [
          {
            id: 99,
            status: "cancelled",
            pending_reason: cascadePendingReason,
            next_attempt_at: null,
          },
        ],
      });
      const pool = { query: poolQuery };

      mockFindUnique.mockResolvedValueOnce({ order: 1 }); // thisStep = wave 1
      mockFindFirst.mockResolvedValueOnce(null); // no predecessor

      const result = await reconcileOrphanedPendingExecutions({
        db: makeDb(),
        dataQueuePool: pool,
        logger: makeLogger(),
      });

      expect(result).toEqual({ reEnqueued: 0, settled: 1 });
    });
  });

  it("continues processing subsequent rows when one row throws", async () => {
    const rowFail = makePendingRow({ jobId: "job-bad" });
    const rowOk = makePendingRow({
      jobId: "job-ok",
      scheduleExecutionId: null,
      pipelineStepId: null,
    });
    mockFindMany.mockResolvedValue([rowFail, rowOk]);

    const poolQuery = vi
      .fn()
      // job-bad lookup throws
      .mockRejectedValueOnce(new Error("DB error"))
      // job-ok: absent
      .mockResolvedValueOnce({ rows: [] });

    const pool = { query: poolQuery };
    mockUpdate.mockResolvedValue(undefined);

    const logger = makeLogger();
    const result = await reconcileOrphanedPendingExecutions({
      db: makeDb(),
      dataQueuePool: pool,
      logger,
    });

    expect(result.settled).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-bad" }),
      expect.stringContaining(
        "reconcile_orphaned_pending: failed to process row",
      ),
    );
  });

  it("marks directly as failed (no applyInvocationCompletion) when no parent execution id", async () => {
    const row = makePendingRow({
      scheduleExecutionId: null,
      httpTriggerExecutionId: null,
      manualExecutionId: null,
      pipelineStepId: null,
    });
    mockFindMany.mockResolvedValue([row]);
    const pool = makePool([]); // absent job
    mockUpdate.mockResolvedValue(undefined);

    const result = await reconcileOrphanedPendingExecutions({
      db: makeDb(),
      dataQueuePool: pool,
      logger: makeLogger(),
    });

    expect(result).toEqual({ reEnqueued: 0, settled: 1 });
    expect(applyInvocationCompletion).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { jobId: "job-1" },
      data: expect.objectContaining({
        status: AgentJobExecutionStatus.failed,
        completedAt: expect.any(Date),
      }),
    });
  });

  it("regression: mirrors execution 3af5f40e — cascade-cancelled delivery after succeeded content-gen re-enqueues", async () => {
    // Delivery step jobs (wave 3) were cascade-cancelled after a transient
    // content-gen failure. Content-gen ultimately succeeded (rollup = success).
    // The reconcile sweep must re-enqueue the delivery jobs.
    const deliveryRow = makePendingRow({
      jobId: "delivery-job-1",
      scheduleExecutionId: "exec-3af5f40e",
      pipelineStepId: "delivery-step",
      pipelineId: "pipeline-mediapulse",
    });
    mockFindMany.mockResolvedValue([deliveryRow]);

    const cascadeReason = JSON.stringify({
      rootJobId: 777,
      dependencyCascade: true,
    });
    const poolQuery = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            id: 555,
            status: "cancelled",
            pending_reason: cascadeReason,
            next_attempt_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: 555 }] }); // UPDATE succeeded

    mockFindUnique.mockResolvedValueOnce({ order: 3 }); // delivery is step 3
    mockFindFirst.mockResolvedValueOnce({ id: "content-gen-step" }); // predecessor = content-gen
    mockFindUnique.mockResolvedValueOnce({
      rollupStatus: ScheduleStepRollupStatus.success,
    }); // content-gen succeeded

    const result = await reconcileOrphanedPendingExecutions({
      db: makeDb(),
      dataQueuePool: { query: poolQuery },
      logger: makeLogger(),
    });

    expect(result).toEqual({ reEnqueued: 1, settled: 0 });
    expect(applyInvocationCompletion).not.toHaveBeenCalled();
  });
});
