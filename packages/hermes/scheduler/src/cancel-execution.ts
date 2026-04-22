import {
  AgentJobExecutionStatus,
  Prisma,
  ScheduleRunStatus,
  ScheduleStepRollupStatus,
  type PrismaClient,
} from "@hermes/orchestration-database";
import {
  computeStepRollupFromCounts,
  type StepRollupTerminal,
} from "./schedule-rollup";
import {
  parseEffectiveExecutionConfig,
  type ExecutionConfig,
} from "./execution-config";

/** Minimal DataQueue surface used to drop pending `invoke_agent` work by Hermes tags. */
export type HermesDataQueueForCancel = {
  cancelAllUpcomingJobs: (filter: {
    tags: { values: string[]; mode: "all" };
  }) => Promise<unknown>;
};

const userCancelError = (): Prisma.InputJsonValue =>
  ({
    cancelled: true,
    message: "Execution was cancelled",
    retryable: false,
  }) as Prisma.InputJsonValue;

/**
 * Returns true when `error` is a structured user-cancel payload (`cancelled: true`).
 */
export function errorIndicatesUserCancel(error: unknown): boolean {
  if (error == null || typeof error !== "object" || Array.isArray(error)) {
    return false;
  }
  return (error as Record<string, unknown>).cancelled === true;
}

/**
 * Resolves parent `ScheduleRunStatus` once every `AgentJobExecution` for the execution is terminal
 * and `cancelledAt` was set (user requested cancellation).
 */
export type StepJobRollupInput = {
  status: AgentJobExecutionStatus;
  error: Prisma.JsonValue | null;
};

/**
 * Computes per-step rollup Prisma status after an invocation completes, respecting
 * user-cancelled invocations when `cancelledAt` is set on the parent execution.
 */
export function resolveStepRollupPrismaAfterInvocation(args: {
  cancelledAt: Date | null;
  stepJobs: StepJobRollupInput[];
  succeededCount: number;
  failedCount: number;
  expectedInvocationCount: number;
  policy: ExecutionConfig["stepRollupPolicy"];
}): ScheduleStepRollupStatus {
  const {
    cancelledAt,
    stepJobs,
    succeededCount,
    failedCount,
    expectedInvocationCount,
    policy,
  } = args;

  if (
    cancelledAt &&
    stepJobs.length > 0 &&
    succeededCount + failedCount >= expectedInvocationCount
  ) {
    const allUserCancel = stepJobs.every(
      (j) =>
        j.status === AgentJobExecutionStatus.cancelled ||
        (j.status === AgentJobExecutionStatus.failed &&
          errorIndicatesUserCancel(j.error)),
    );
    if (allUserCancel) {
      return ScheduleStepRollupStatus.cancelled;
    }
  }

  const rollupTerminal = computeStepRollupFromCounts(
    succeededCount,
    failedCount,
    policy,
  );
  return stepRollupTerminalToPrisma(rollupTerminal);
}

/**
 * Derives the parent schedule run status after cancellation when every job is terminal.
 */
export function resolveRunStatusForSettledCancelledExecution(
  jobs: Array<{
    status: AgentJobExecutionStatus;
    error: Prisma.JsonValue | null;
  }>,
): ScheduleRunStatus {
  const hasCompleted = jobs.some(
    (j) => j.status === AgentJobExecutionStatus.completed,
  );
  const hasAgentFailure = jobs.some(
    (j) =>
      j.status === AgentJobExecutionStatus.failed &&
      !errorIndicatesUserCancel(j.error),
  );
  const hasUserCancel =
    jobs.some((j) => j.status === AgentJobExecutionStatus.cancelled) ||
    jobs.some(
      (j) =>
        j.status === AgentJobExecutionStatus.failed &&
        errorIndicatesUserCancel(j.error),
    );

  if (hasAgentFailure) {
    return ScheduleRunStatus.failed;
  }
  if (hasCompleted && hasUserCancel) {
    return ScheduleRunStatus.partial;
  }
  if (hasCompleted) {
    return ScheduleRunStatus.succeeded;
  }
  if (
    jobs.length > 0 &&
    jobs.every(
      (j) =>
        j.status === AgentJobExecutionStatus.cancelled ||
        (j.status === AgentJobExecutionStatus.failed &&
          errorIndicatesUserCancel(j.error)),
    )
  ) {
    return ScheduleRunStatus.cancelled;
  }
  return ScheduleRunStatus.failed;
}

function defaultExecutionConfig(): ExecutionConfig {
  return {
    schemaVersion: 1,
    stepRollupPolicy: "strict",
    stepOrder: "sequential",
    continueSequentialAfterPartial: false,
  };
}

function loadExecutionConfig(
  raw: Prisma.JsonValue | null | undefined,
): ExecutionConfig {
  try {
    const obj =
      raw != null && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    return parseEffectiveExecutionConfig(obj);
  } catch {
    return defaultExecutionConfig();
  }
}

function stepRollupTerminalToPrisma(
  r: StepRollupTerminal,
): ScheduleStepRollupStatus {
  switch (r) {
    case "success":
      return ScheduleStepRollupStatus.success;
    case "partial":
      return ScheduleStepRollupStatus.partial;
    case "failed":
      return ScheduleStepRollupStatus.failed;
  }
}

async function reconcileStepRollupsForScheduleExecution(
  tx: Prisma.TransactionClient,
  scheduleExecutionId: string,
  policy: ExecutionConfig["stepRollupPolicy"],
): Promise<StepRollupTerminal[]> {
  const jobs = await tx.agentJobExecution.findMany({
    where: { scheduleExecutionId },
    select: {
      pipelineStepId: true,
      status: true,
      error: true,
    },
  });
  const jobsByStep = new Map<string, typeof jobs>();
  for (const j of jobs) {
    const pid = j.pipelineStepId;
    if (!pid) continue;
    const list = jobsByStep.get(pid) ?? [];
    list.push(j);
    jobsByStep.set(pid, list);
  }

  const steps = await tx.scheduleStepExecution.findMany({
    where: { scheduleExecutionId },
  });

  const stepTerminals: StepRollupTerminal[] = [];

  for (const step of steps) {
    const stepJobs = jobsByStep.get(step.pipelineStepId) ?? [];
    const e = step.expectedInvocationCount;
    const s = step.succeededCount;
    const f = step.failedCount;
    if (s + f < e) {
      await tx.scheduleStepExecution.update({
        where: { id: step.id },
        data: {
          succeededCount: s,
          failedCount: f,
          rollupStatus:
            s + f > 0
              ? ScheduleStepRollupStatus.running
              : ScheduleStepRollupStatus.pending,
        },
      });
      continue;
    }

    const allUserCancel =
      stepJobs.length > 0 &&
      stepJobs.every(
        (j) =>
          j.status === AgentJobExecutionStatus.cancelled ||
          (j.status === AgentJobExecutionStatus.failed &&
            errorIndicatesUserCancel(j.error)),
      );

    const rollupPrisma = allUserCancel
      ? ScheduleStepRollupStatus.cancelled
      : stepRollupTerminalToPrisma(computeStepRollupFromCounts(s, f, policy));

    await tx.scheduleStepExecution.update({
      where: { id: step.id },
      data: {
        succeededCount: s,
        failedCount: f,
        rollupStatus: rollupPrisma,
      },
    });
    stepTerminals.push(prismaRollupToStepTerminalForParentRun(rollupPrisma));
  }

  return stepTerminals;
}

async function reconcileStepRollupsForHttpTriggerExecution(
  tx: Prisma.TransactionClient,
  httpTriggerExecutionId: string,
  policy: ExecutionConfig["stepRollupPolicy"],
): Promise<StepRollupTerminal[]> {
  const jobs = await tx.agentJobExecution.findMany({
    where: { httpTriggerExecutionId },
    select: {
      pipelineStepId: true,
      status: true,
      error: true,
    },
  });
  const jobsByStep = new Map<string, typeof jobs>();
  for (const j of jobs) {
    const pid = j.pipelineStepId;
    if (!pid) continue;
    const list = jobsByStep.get(pid) ?? [];
    list.push(j);
    jobsByStep.set(pid, list);
  }

  const steps = await tx.httpTriggerStepExecution.findMany({
    where: { httpTriggerExecutionId },
  });

  const stepTerminals: StepRollupTerminal[] = [];

  for (const step of steps) {
    const stepJobs = jobsByStep.get(step.pipelineStepId) ?? [];
    const e = step.expectedInvocationCount;
    const s = step.succeededCount;
    const f = step.failedCount;
    if (s + f < e) {
      await tx.httpTriggerStepExecution.update({
        where: { id: step.id },
        data: {
          succeededCount: s,
          failedCount: f,
          rollupStatus:
            s + f > 0
              ? ScheduleStepRollupStatus.running
              : ScheduleStepRollupStatus.pending,
        },
      });
      continue;
    }

    const allUserCancel =
      stepJobs.length > 0 &&
      stepJobs.every(
        (j) =>
          j.status === AgentJobExecutionStatus.cancelled ||
          (j.status === AgentJobExecutionStatus.failed &&
            errorIndicatesUserCancel(j.error)),
      );

    const rollupPrisma = allUserCancel
      ? ScheduleStepRollupStatus.cancelled
      : stepRollupTerminalToPrisma(computeStepRollupFromCounts(s, f, policy));

    await tx.httpTriggerStepExecution.update({
      where: { id: step.id },
      data: {
        succeededCount: s,
        failedCount: f,
        rollupStatus: rollupPrisma,
      },
    });
    stepTerminals.push(prismaRollupToStepTerminalForParentRun(rollupPrisma));
  }

  return stepTerminals;
}

function prismaRollupToStepTerminalForParentRun(
  r: ScheduleStepRollupStatus,
): StepRollupTerminal {
  switch (r) {
    case ScheduleStepRollupStatus.success:
      return "success";
    case ScheduleStepRollupStatus.partial:
      return "partial";
    case ScheduleStepRollupStatus.cancelled:
    case ScheduleStepRollupStatus.failed:
    case ScheduleStepRollupStatus.skipped:
    case ScheduleStepRollupStatus.running:
    case ScheduleStepRollupStatus.pending:
    default:
      return "failed";
  }
}

export type CancelScheduleExecutionResult =
  | { ok: true; scheduleExecutionId: string }
  | { ok: false; reason: "not_found" | "already_terminal" };

export type CancelHttpTriggerExecutionResult =
  | { ok: true; httpTriggerExecutionId: string }
  | { ok: false; reason: "not_found" | "already_terminal" };

/**
 * Cancels a schedule execution: drops queued `invoke_agent` jobs by tag, marks pending
 * invocations cancelled, reconciles step rollups, and sets parent `runStatus` when no
 * invocations remain `running`.
 */
export const cancelScheduleExecution = async (
  db: PrismaClient,
  queue: HermesDataQueueForCancel,
  scheduleExecutionId: string,
): Promise<CancelScheduleExecutionResult> => {
  const existing = await db.scheduleExecution.findUnique({
    where: { id: scheduleExecutionId },
    select: {
      id: true,
      runStatus: true,
      effectiveExecutionConfig: true,
      failedInvocationCount: true,
      succeededInvocationCount: true,
    },
  });
  if (!existing) {
    return { ok: false, reason: "not_found" };
  }
  if (
    existing.runStatus !== ScheduleRunStatus.pending &&
    existing.runStatus !== ScheduleRunStatus.running
  ) {
    return { ok: false, reason: "already_terminal" };
  }

  await queue.cancelAllUpcomingJobs({
    tags: { values: [`scheduleExecution:${scheduleExecutionId}`], mode: "all" },
  });

  const now = new Date();
  const policy = loadExecutionConfig(
    existing.effectiveExecutionConfig,
  ).stepRollupPolicy;

  await db.$transaction(async (tx) => {
    const pending = await tx.agentJobExecution.findMany({
      where: {
        scheduleExecutionId,
        status: AgentJobExecutionStatus.pending,
      },
      select: { id: true, pipelineStepId: true },
    });

    const cancelledByStep = new Map<string, number>();
    for (const row of pending) {
      const pid = row.pipelineStepId;
      if (!pid) continue;
      cancelledByStep.set(pid, (cancelledByStep.get(pid) ?? 0) + 1);
    }

    if (pending.length > 0) {
      await tx.agentJobExecution.updateMany({
        where: {
          scheduleExecutionId,
          status: AgentJobExecutionStatus.pending,
        },
        data: {
          status: AgentJobExecutionStatus.cancelled,
          completedAt: now,
          error: userCancelError(),
        },
      });
    }

    for (const [pipelineStepId, n] of cancelledByStep) {
      await tx.scheduleStepExecution.updateMany({
        where: { scheduleExecutionId, pipelineStepId },
        data: { failedCount: { increment: n } },
      });
    }

    const runningLeft = await tx.agentJobExecution.count({
      where: {
        scheduleExecutionId,
        status: AgentJobExecutionStatus.running,
      },
    });

    await tx.scheduleExecution.update({
      where: { id: scheduleExecutionId },
      data: {
        cancelledAt: now,
        failedInvocationCount: { increment: pending.length },
      },
    });

    if (runningLeft > 0) {
      return;
    }

    const stepTerminals = await reconcileStepRollupsForScheduleExecution(
      tx,
      scheduleExecutionId,
      policy,
    );
    const stepsAfter = await tx.scheduleStepExecution.findMany({
      where: { scheduleExecutionId },
      select: {
        expectedInvocationCount: true,
        succeededCount: true,
        failedCount: true,
      },
    });
    const allStepsTerminal =
      stepsAfter.length > 0 &&
      stepsAfter.every(
        (row) =>
          row.succeededCount + row.failedCount >= row.expectedInvocationCount,
      );
    if (!allStepsTerminal) {
      return;
    }

    const jobs = await tx.agentJobExecution.findMany({
      where: { scheduleExecutionId },
      select: { status: true, error: true },
    });
    const finalRun = resolveRunStatusForSettledCancelledExecution(jobs);

    await tx.scheduleExecution.update({
      where: { id: scheduleExecutionId },
      data: { runStatus: finalRun },
    });
  });

  return { ok: true, scheduleExecutionId };
};

/**
 * Cancels an HTTP trigger execution (same semantics as {@link cancelScheduleExecution}).
 */
export const cancelHttpTriggerExecution = async (
  db: PrismaClient,
  queue: HermesDataQueueForCancel,
  httpTriggerExecutionId: string,
): Promise<CancelHttpTriggerExecutionResult> => {
  const existing = await db.httpTriggerExecution.findUnique({
    where: { id: httpTriggerExecutionId },
    select: {
      id: true,
      runStatus: true,
      effectiveExecutionConfig: true,
    },
  });
  if (!existing) {
    return { ok: false, reason: "not_found" };
  }
  if (
    existing.runStatus !== ScheduleRunStatus.pending &&
    existing.runStatus !== ScheduleRunStatus.running
  ) {
    return { ok: false, reason: "already_terminal" };
  }

  await queue.cancelAllUpcomingJobs({
    tags: {
      values: [`httpTriggerExecution:${httpTriggerExecutionId}`],
      mode: "all",
    },
  });

  const now = new Date();
  const policy = loadExecutionConfig(
    existing.effectiveExecutionConfig,
  ).stepRollupPolicy;

  await db.$transaction(async (tx) => {
    const pending = await tx.agentJobExecution.findMany({
      where: {
        httpTriggerExecutionId,
        status: AgentJobExecutionStatus.pending,
      },
      select: { id: true, pipelineStepId: true },
    });

    const cancelledByStep = new Map<string, number>();
    for (const row of pending) {
      const pid = row.pipelineStepId;
      if (!pid) continue;
      cancelledByStep.set(pid, (cancelledByStep.get(pid) ?? 0) + 1);
    }

    if (pending.length > 0) {
      await tx.agentJobExecution.updateMany({
        where: {
          httpTriggerExecutionId,
          status: AgentJobExecutionStatus.pending,
        },
        data: {
          status: AgentJobExecutionStatus.cancelled,
          completedAt: now,
          error: userCancelError(),
        },
      });
    }

    for (const [pipelineStepId, n] of cancelledByStep) {
      await tx.httpTriggerStepExecution.updateMany({
        where: { httpTriggerExecutionId, pipelineStepId },
        data: { failedCount: { increment: n } },
      });
    }

    const runningLeft = await tx.agentJobExecution.count({
      where: {
        httpTriggerExecutionId,
        status: AgentJobExecutionStatus.running,
      },
    });

    await tx.httpTriggerExecution.update({
      where: { id: httpTriggerExecutionId },
      data: {
        cancelledAt: now,
        failedInvocationCount: { increment: pending.length },
      },
    });

    if (runningLeft > 0) {
      return;
    }

    const stepTerminals = await reconcileStepRollupsForHttpTriggerExecution(
      tx,
      httpTriggerExecutionId,
      policy,
    );
    const stepsAfter = await tx.httpTriggerStepExecution.findMany({
      where: { httpTriggerExecutionId },
      select: {
        expectedInvocationCount: true,
        succeededCount: true,
        failedCount: true,
      },
    });
    const allStepsTerminal =
      stepsAfter.length > 0 &&
      stepsAfter.every(
        (row) =>
          row.succeededCount + row.failedCount >= row.expectedInvocationCount,
      );
    if (!allStepsTerminal) {
      return;
    }

    const jobs = await tx.agentJobExecution.findMany({
      where: { httpTriggerExecutionId },
      select: { status: true, error: true },
    });
    const finalRun = resolveRunStatusForSettledCancelledExecution(jobs);

    await tx.httpTriggerExecution.update({
      where: { id: httpTriggerExecutionId },
      data: { runStatus: finalRun },
    });
  });

  return { ok: true, httpTriggerExecutionId };
};

/**
 * When a cancelled execution still had `running` jobs that have now finished, finalize
 * parent `runStatus` and step rollups if every step is terminal.
 */
export const finalizeCancelledExecutionIfSettled = async (
  db: PrismaClient,
  args:
    | { kind: "schedule"; scheduleExecutionId: string }
    | { kind: "httpTrigger"; httpTriggerExecutionId: string },
): Promise<void> => {
  const isSchedule = args.kind === "schedule";
  const executionId = isSchedule
    ? args.scheduleExecutionId
    : args.httpTriggerExecutionId;

  const execution = isSchedule
    ? await db.scheduleExecution.findUnique({
        where: { id: executionId },
        select: {
          cancelledAt: true,
          runStatus: true,
          effectiveExecutionConfig: true,
        },
      })
    : await db.httpTriggerExecution.findUnique({
        where: { id: executionId },
        select: {
          cancelledAt: true,
          runStatus: true,
          effectiveExecutionConfig: true,
        },
      });

  if (!execution?.cancelledAt) {
    return;
  }
  if (
    execution.runStatus !== ScheduleRunStatus.pending &&
    execution.runStatus !== ScheduleRunStatus.running
  ) {
    return;
  }

  const runningCount = await db.agentJobExecution.count({
    where: isSchedule
      ? {
          scheduleExecutionId: executionId,
          status: AgentJobExecutionStatus.running,
        }
      : {
          httpTriggerExecutionId: executionId,
          status: AgentJobExecutionStatus.running,
        },
  });
  if (runningCount > 0) {
    return;
  }

  const policy = loadExecutionConfig(
    execution.effectiveExecutionConfig,
  ).stepRollupPolicy;

  await db.$transaction(async (tx) => {
    await (isSchedule
      ? reconcileStepRollupsForScheduleExecution(tx, executionId, policy)
      : reconcileStepRollupsForHttpTriggerExecution(tx, executionId, policy));

    const stepsAfter = isSchedule
      ? await tx.scheduleStepExecution.findMany({
          where: { scheduleExecutionId: executionId },
          select: {
            expectedInvocationCount: true,
            succeededCount: true,
            failedCount: true,
          },
        })
      : await tx.httpTriggerStepExecution.findMany({
          where: { httpTriggerExecutionId: executionId },
          select: {
            expectedInvocationCount: true,
            succeededCount: true,
            failedCount: true,
          },
        });

    const allStepsTerminal =
      stepsAfter.length > 0 &&
      stepsAfter.every(
        (row) =>
          row.succeededCount + row.failedCount >= row.expectedInvocationCount,
      );
    if (!allStepsTerminal) {
      return;
    }

    const jobs = await tx.agentJobExecution.findMany({
      where: isSchedule
        ? { scheduleExecutionId: executionId }
        : { httpTriggerExecutionId: executionId },
      select: { status: true, error: true },
    });

    const pendingLeft = jobs.filter(
      (j) => j.status === AgentJobExecutionStatus.pending,
    ).length;
    if (pendingLeft > 0) {
      return;
    }

    const finalRun = resolveRunStatusForSettledCancelledExecution(jobs);

    if (isSchedule) {
      await tx.scheduleExecution.update({
        where: { id: executionId },
        data: { runStatus: finalRun },
      });
    } else {
      await tx.httpTriggerExecution.update({
        where: { id: executionId },
        data: { runStatus: finalRun },
      });
    }
  });
};

export type MarkManualPipelineCancelledResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "already_terminal" };

/**
 * Marks a manual dashboard pipeline run as user-cancelled (`cancelledAt`). The run loop
 * should observe this and call {@link finalizeManualPipelineExecutionAfterCooperativeCancel}.
 */
export const markManualPipelineExecutionCancelled = async (
  db: PrismaClient,
  manualExecutionId: string,
): Promise<MarkManualPipelineCancelledResult> => {
  const row = await db.manualPipelineExecution.findUnique({
    where: { id: manualExecutionId },
    select: { runStatus: true },
  });
  if (!row) {
    return { ok: false, reason: "not_found" };
  }
  if (row.runStatus !== ScheduleRunStatus.running) {
    return { ok: false, reason: "already_terminal" };
  }
  await db.manualPipelineExecution.update({
    where: { id: manualExecutionId },
    data: { cancelledAt: new Date() },
  });
  return { ok: true };
};

export type PlannedJobForManualCancel = {
  jobId: string;
  pipelineStepId: string;
};

/**
 * After a cooperative cancel break in the manual run loop: increments per-step `failedCount`
 * for jobs that never started, cancels any remaining `running` rows, recomputes rollups, and
 * sets parent `runStatus`.
 */
export const finalizeManualPipelineExecutionAfterCooperativeCancel = async (
  db: PrismaClient,
  args: {
    manualExecutionId: string;
    plannedJobs: PlannedJobForManualCancel[];
    processedJobIds: ReadonlySet<string>;
  },
): Promise<void> => {
  const { manualExecutionId, plannedJobs, processedJobIds } = args;
  const execution = await db.manualPipelineExecution.findUnique({
    where: { id: manualExecutionId },
    select: { effectiveExecutionConfig: true, cancelledAt: true },
  });
  if (!execution?.cancelledAt) {
    return;
  }

  const policy = loadExecutionConfig(
    execution.effectiveExecutionConfig,
  ).stepRollupPolicy;
  const now = new Date();

  await db.$transaction(async (tx) => {
    const remainingByStep = new Map<string, number>();
    for (const job of plannedJobs) {
      if (processedJobIds.has(job.jobId)) {
        continue;
      }
      const row = await tx.agentJobExecution.findUnique({
        where: { jobId: job.jobId },
        select: { id: true },
      });
      if (!row) {
        remainingByStep.set(
          job.pipelineStepId,
          (remainingByStep.get(job.pipelineStepId) ?? 0) + 1,
        );
      }
    }
    for (const [pipelineStepId, n] of remainingByStep) {
      await tx.manualPipelineStepExecution.updateMany({
        where: { manualExecutionId, pipelineStepId },
        data: { failedCount: { increment: n } },
      });
    }

    await tx.agentJobExecution.updateMany({
      where: { manualExecutionId, status: AgentJobExecutionStatus.running },
      data: {
        status: AgentJobExecutionStatus.cancelled,
        completedAt: now,
        error: userCancelError(),
      },
    });

    const steps = await tx.manualPipelineStepExecution.findMany({
      where: { manualExecutionId },
    });
    for (const step of steps) {
      const s = step.succeededCount;
      const f = step.failedCount;
      const e = step.expectedInvocationCount;
      if (e === 0) {
        continue;
      }
      if (s + f < e) {
        continue;
      }
      const stepJobs = await tx.agentJobExecution.findMany({
        where: { manualExecutionId, pipelineStepId: step.pipelineStepId },
        select: { status: true, error: true },
      });
      const allUserCancel =
        stepJobs.length > 0 &&
        stepJobs.every(
          (j) =>
            j.status === AgentJobExecutionStatus.cancelled ||
            (j.status === AgentJobExecutionStatus.failed &&
              errorIndicatesUserCancel(j.error)),
        );
      const rollupPrisma = allUserCancel
        ? ScheduleStepRollupStatus.cancelled
        : stepRollupTerminalToPrisma(computeStepRollupFromCounts(s, f, policy));
      await tx.manualPipelineStepExecution.update({
        where: {
          manualExecutionId_pipelineStepId: {
            manualExecutionId,
            pipelineStepId: step.pipelineStepId,
          },
        },
        data: { rollupStatus: rollupPrisma },
      });
    }

    const jobs = await tx.agentJobExecution.findMany({
      where: { manualExecutionId },
      select: { status: true, error: true },
    });
    const succeededInvocationCount = jobs.filter(
      (j) => j.status === AgentJobExecutionStatus.completed,
    ).length;
    const failedInvocationCount = jobs.filter(
      (j) =>
        j.status === AgentJobExecutionStatus.failed ||
        j.status === AgentJobExecutionStatus.cancelled,
    ).length;
    const finalRun = resolveRunStatusForSettledCancelledExecution(jobs);

    await tx.manualPipelineExecution.update({
      where: { id: manualExecutionId },
      data: {
        runStatus: finalRun,
        succeededInvocationCount,
        failedInvocationCount,
      },
    });
  });
};

/** @internal Exported for tests — maps step rollup row to coarse terminal for parent run math. */
export const __testOnlyPrismaRollupToStepTerminalForParentRun =
  prismaRollupToStepTerminalForParentRun;
