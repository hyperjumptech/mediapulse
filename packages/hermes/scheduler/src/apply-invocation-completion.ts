import {
  AgentJobExecutionStatus,
  Prisma,
  type PrismaClient,
  ScheduleRunStatus,
  ScheduleStepRollupStatus,
} from "@hermes/orchestration-database";
import type { ParsedAgentResponseEnvelope } from "./agent-response-envelope";
import {
  parseEffectiveExecutionConfig,
  type ExecutionConfig,
} from "./execution-config";
import {
  computeExecutionRunStatusFromStepRollups,
  type StepRollupTerminal,
} from "./schedule-rollup";
import {
  resolveRunStatusForSettledCancelledExecution,
  resolveStepRollupPrismaAfterInvocation,
} from "./cancel-execution";
import {
  countInvocationOutcomesFromTerminalJobs,
  resolveParentRunStatusWhenStepRowsMissing,
} from "./finalize-parent-from-terminal-jobs";

export type InvocationCompletionInput = {
  jobId: string;
  scheduleExecutionId?: string;
  httpTriggerExecutionId?: string;
  /** Dashboard manual pipeline execution id (mutually exclusive with schedule/http trigger ids). */
  manualExecutionId?: string;
  pipelineStepId: string;
  terminal:
    | {
        status: typeof AgentJobExecutionStatus.completed;
        envelope: ParsedAgentResponseEnvelope;
      }
    | {
        status: typeof AgentJobExecutionStatus.failed;
        error: Prisma.InputJsonValue;
        agentResponse?: Prisma.InputJsonValue;
        semanticStatus?: string | null;
      }
    | {
        status: typeof AgentJobExecutionStatus.cancelled;
        error: Prisma.InputJsonValue;
      };
};

/**
 * Dependencies for applying invocation completion (Prisma + logger).
 */
export type ApplyInvocationCompletionDeps = {
  db: PrismaClient;
  logger: {
    warn: (obj: unknown, msg?: string) => void;
    error: (obj: unknown, msg?: string) => void;
  };
};

type ExecutionKind = "schedule" | "httpTrigger" | "manual";

const defaultExecutionConfig = (): ExecutionConfig => ({
  schemaVersion: 1,
  stepRollupPolicy: "strict",
  stepOrder: "sequential",
  continueSequentialAfterPartial: false,
});

const loadExecutionConfig = (
  raw: Prisma.JsonValue | null | undefined,
  logger: ApplyInvocationCompletionDeps["logger"],
  executionKey: string,
): ExecutionConfig => {
  try {
    const obj =
      raw != null && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    return parseEffectiveExecutionConfig(obj);
  } catch (err) {
    logger.error(
      { err, executionKey },
      "applyInvocationCompletion: invalid effectiveExecutionConfig",
    );
    return defaultExecutionConfig();
  }
};

/**
 * Resolves which parent execution row drives rollup updates.
 *
 * @param input - Invocation completion payload.
 * @returns Kind discriminator, or null when no parent id is set.
 */
const resolveExecutionKind = (
  input: InvocationCompletionInput,
): ExecutionKind | null => {
  if (input.scheduleExecutionId) return "schedule";
  if (input.httpTriggerExecutionId) return "httpTrigger";
  if (input.manualExecutionId) return "manual";
  return null;
};

/**
 * Updates `AgentJobExecution`, increments step counters, recomputes step rollup, and idempotently
 * updates parent execution `runStatus` when all step rows are terminal (schedule, HTTP trigger, or manual pipeline).
 *
 * @param input - Terminal state for one invocation.
 * @param deps - DB client and logger.
 */
export const applyInvocationCompletion = async (
  input: InvocationCompletionInput,
  deps: ApplyInvocationCompletionDeps,
): Promise<void> => {
  const { db, logger } = deps;

  const executionKind = resolveExecutionKind(input);
  if (executionKind == null) {
    logger.warn(
      {
        scheduleExecutionId: input.scheduleExecutionId,
        httpTriggerExecutionId: input.httpTriggerExecutionId,
        manualExecutionId: input.manualExecutionId,
        jobId: input.jobId,
      },
      "applyInvocationCompletion: no parent execution id on input",
    );
    return;
  }

  const execution =
    executionKind === "schedule"
      ? await db.scheduleExecution.findUnique({
          where: { id: input.scheduleExecutionId! },
          select: {
            id: true,
            runStatus: true,
            cancelledAt: true,
            effectiveExecutionConfig: true,
          },
        })
      : executionKind === "httpTrigger"
        ? await db.httpTriggerExecution.findUnique({
            where: { id: input.httpTriggerExecutionId! },
            select: {
              id: true,
              runStatus: true,
              cancelledAt: true,
              effectiveExecutionConfig: true,
            },
          })
        : await db.manualPipelineExecution.findUnique({
            where: { id: input.manualExecutionId! },
            select: {
              id: true,
              runStatus: true,
              cancelledAt: true,
              effectiveExecutionConfig: true,
            },
          });

  if (!execution) {
    logger.warn(
      {
        scheduleExecutionId: input.scheduleExecutionId,
        httpTriggerExecutionId: input.httpTriggerExecutionId,
        manualExecutionId: input.manualExecutionId,
        jobId: input.jobId,
      },
      "applyInvocationCompletion: execution not found",
    );
    return;
  }
  if (
    execution.runStatus !== ScheduleRunStatus.pending &&
    execution.runStatus !== ScheduleRunStatus.running
  ) {
    return;
  }

  const executionKeyForLog =
    input.scheduleExecutionId ??
    input.httpTriggerExecutionId ??
    input.manualExecutionId ??
    "unknown";

  const config = loadExecutionConfig(
    execution.effectiveExecutionConfig,
    logger,
    executionKeyForLog,
  );

  const isSuccess = input.terminal.status === AgentJobExecutionStatus.completed;
  const isCancelled =
    input.terminal.status === AgentJobExecutionStatus.cancelled;

  let agentData: {
    status: AgentJobExecutionStatus;
    completedAt: Date;
    error: Prisma.InputJsonValue | typeof Prisma.DbNull;
    agentResponse: Prisma.InputJsonValue | typeof Prisma.DbNull;
    semanticStatus: string | null;
  };

  if (input.terminal.status === AgentJobExecutionStatus.completed) {
    agentData = {
      status: AgentJobExecutionStatus.completed,
      completedAt: new Date(),
      error: Prisma.DbNull,
      agentResponse: input.terminal
        .envelope as unknown as Prisma.InputJsonValue,
      semanticStatus: input.terminal.envelope.status,
    };
  } else if (isCancelled) {
    agentData = {
      status: AgentJobExecutionStatus.cancelled,
      completedAt: new Date(),
      error: input.terminal.error,
      agentResponse: Prisma.DbNull,
      semanticStatus: null,
    };
  } else if (input.terminal.status === AgentJobExecutionStatus.failed) {
    agentData = {
      status: AgentJobExecutionStatus.failed,
      completedAt: new Date(),
      error: input.terminal.error,
      agentResponse: input.terminal.agentResponse ?? Prisma.DbNull,
      semanticStatus: input.terminal.semanticStatus ?? null,
    };
  } else {
    throw new Error("applyInvocationCompletion: unsupported terminal status");
  }

  const execCountInc = isSuccess
    ? { succeededInvocationCount: { increment: 1 } }
    : { failedInvocationCount: { increment: 1 } };

  await db.$transaction(async (tx) => {
    await tx.agentJobExecution.update({
      where: { jobId: input.jobId },
      data: agentData,
    });

    if (executionKind === "schedule") {
      await tx.scheduleExecution.update({
        where: { id: input.scheduleExecutionId },
        data: {
          runStatus: ScheduleRunStatus.running,
          ...execCountInc,
        },
      });
    } else if (executionKind === "httpTrigger") {
      await tx.httpTriggerExecution.update({
        where: { id: input.httpTriggerExecutionId },
        data: {
          runStatus: ScheduleRunStatus.running,
          ...execCountInc,
        },
      });
    } else {
      await tx.manualPipelineExecution.update({
        where: { id: input.manualExecutionId },
        data: {
          runStatus: ScheduleRunStatus.running,
          ...execCountInc,
        },
      });
    }

    const stepRow =
      executionKind === "schedule"
        ? await tx.scheduleStepExecution.findUnique({
            where: {
              scheduleExecutionId_pipelineStepId: {
                scheduleExecutionId: input.scheduleExecutionId!,
                pipelineStepId: input.pipelineStepId,
              },
            },
          })
        : executionKind === "httpTrigger"
          ? await tx.httpTriggerStepExecution.findUnique({
              where: {
                httpTriggerExecutionId_pipelineStepId: {
                  httpTriggerExecutionId: input.httpTriggerExecutionId!,
                  pipelineStepId: input.pipelineStepId,
                },
              },
            })
          : await tx.manualPipelineStepExecution.findUnique({
              where: {
                manualExecutionId_pipelineStepId: {
                  manualExecutionId: input.manualExecutionId!,
                  pipelineStepId: input.pipelineStepId,
                },
              },
            });
    if (!stepRow) {
      const jobsWithoutStepRollup =
        executionKind === "schedule"
          ? await tx.agentJobExecution.findMany({
              where: { scheduleExecutionId: input.scheduleExecutionId! },
              select: { status: true, error: true },
            })
          : executionKind === "httpTrigger"
            ? await tx.agentJobExecution.findMany({
                where: {
                  httpTriggerExecutionId: input.httpTriggerExecutionId!,
                },
                select: { status: true, error: true },
              })
            : await tx.agentJobExecution.findMany({
                where: { manualExecutionId: input.manualExecutionId! },
                select: { status: true, error: true },
              });

      const runWithoutStepRollup = resolveParentRunStatusWhenStepRowsMissing(
        jobsWithoutStepRollup,
      );
      if (runWithoutStepRollup == null) {
        return;
      }

      const counts = countInvocationOutcomesFromTerminalJobs(
        jobsWithoutStepRollup,
      );
      const parentWhere = {
        runStatus: {
          in: [ScheduleRunStatus.pending, ScheduleRunStatus.running],
        },
      };

      if (executionKind === "schedule") {
        await tx.scheduleExecution.updateMany({
          where: { id: input.scheduleExecutionId, ...parentWhere },
          data: { runStatus: runWithoutStepRollup, ...counts },
        });
      } else if (executionKind === "httpTrigger") {
        await tx.httpTriggerExecution.updateMany({
          where: { id: input.httpTriggerExecutionId, ...parentWhere },
          data: { runStatus: runWithoutStepRollup, ...counts },
        });
      } else {
        await tx.manualPipelineExecution.updateMany({
          where: { id: input.manualExecutionId, ...parentWhere },
          data: { runStatus: runWithoutStepRollup, ...counts },
        });
      }

      return;
    }

    const inc = isSuccess
      ? { succeededCount: { increment: 1 } }
      : { failedCount: { increment: 1 } }; // failed + user-cancelled terminal both increment failedCount on the step row

    const updated =
      executionKind === "schedule"
        ? await tx.scheduleStepExecution.update({
            where: { id: stepRow.id },
            data: {
              ...inc,
              rollupStatus:
                stepRow.rollupStatus === ScheduleStepRollupStatus.pending
                  ? ScheduleStepRollupStatus.running
                  : stepRow.rollupStatus,
            },
          })
        : executionKind === "httpTrigger"
          ? await tx.httpTriggerStepExecution.update({
              where: { id: stepRow.id },
              data: {
                ...inc,
                rollupStatus:
                  stepRow.rollupStatus === ScheduleStepRollupStatus.pending
                    ? ScheduleStepRollupStatus.running
                    : stepRow.rollupStatus,
              },
            })
          : await tx.manualPipelineStepExecution.update({
              where: { id: stepRow.id },
              data: {
                ...inc,
                rollupStatus:
                  stepRow.rollupStatus === ScheduleStepRollupStatus.pending
                    ? ScheduleStepRollupStatus.running
                    : stepRow.rollupStatus,
              },
            });

    const stepDone =
      updated.succeededCount + updated.failedCount >=
      updated.expectedInvocationCount;
    if (!stepDone) {
      return;
    }

    const executionCancelledAt =
      executionKind === "schedule"
        ? await tx.scheduleExecution.findUnique({
            where: { id: input.scheduleExecutionId! },
            select: { cancelledAt: true },
          })
        : executionKind === "httpTrigger"
          ? await tx.httpTriggerExecution.findUnique({
              where: { id: input.httpTriggerExecutionId! },
              select: { cancelledAt: true },
            })
          : await tx.manualPipelineExecution.findUnique({
              where: { id: input.manualExecutionId! },
              select: { cancelledAt: true },
            });

    const stepJobsForRollup =
      executionKind === "schedule"
        ? await tx.agentJobExecution.findMany({
            where: {
              scheduleExecutionId: input.scheduleExecutionId!,
              pipelineStepId: input.pipelineStepId,
            },
            select: { status: true, error: true },
          })
        : executionKind === "httpTrigger"
          ? await tx.agentJobExecution.findMany({
              where: {
                httpTriggerExecutionId: input.httpTriggerExecutionId!,
                pipelineStepId: input.pipelineStepId,
              },
              select: { status: true, error: true },
            })
          : await tx.agentJobExecution.findMany({
              where: {
                manualExecutionId: input.manualExecutionId!,
                pipelineStepId: input.pipelineStepId,
              },
              select: { status: true, error: true },
            });

    const rollupPrisma = resolveStepRollupPrismaAfterInvocation({
      cancelledAt: executionCancelledAt?.cancelledAt ?? null,
      stepJobs: stepJobsForRollup,
      succeededCount: updated.succeededCount,
      failedCount: updated.failedCount,
      expectedInvocationCount: updated.expectedInvocationCount,
      policy: config.stepRollupPolicy,
    });

    if (executionKind === "schedule") {
      await tx.scheduleStepExecution.update({
        where: { id: stepRow.id },
        data: { rollupStatus: rollupPrisma },
      });
    } else if (executionKind === "httpTrigger") {
      await tx.httpTriggerStepExecution.update({
        where: { id: stepRow.id },
        data: { rollupStatus: rollupPrisma },
      });
    } else {
      await tx.manualPipelineStepExecution.update({
        where: { id: stepRow.id },
        data: { rollupStatus: rollupPrisma },
      });
    }

    const allSteps =
      executionKind === "schedule"
        ? await tx.scheduleStepExecution.findMany({
            where: { scheduleExecutionId: input.scheduleExecutionId! },
            select: { rollupStatus: true },
          })
        : executionKind === "httpTrigger"
          ? await tx.httpTriggerStepExecution.findMany({
              where: { httpTriggerExecutionId: input.httpTriggerExecutionId! },
              select: { rollupStatus: true },
            })
          : await tx.manualPipelineStepExecution.findMany({
              where: { manualExecutionId: input.manualExecutionId! },
              select: { rollupStatus: true },
            });

    const terminalStatuses = new Set<ScheduleStepRollupStatus>([
      ScheduleStepRollupStatus.success,
      ScheduleStepRollupStatus.partial,
      ScheduleStepRollupStatus.failed,
      ScheduleStepRollupStatus.skipped,
      ScheduleStepRollupStatus.cancelled,
    ]);

    const allTerminal = allSteps.every((s) =>
      terminalStatuses.has(s.rollupStatus),
    );
    if (!allTerminal) {
      return;
    }

    const executionRow =
      executionKind === "schedule"
        ? await tx.scheduleExecution.findUnique({
            where: { id: input.scheduleExecutionId! },
            select: { cancelledAt: true },
          })
        : executionKind === "httpTrigger"
          ? await tx.httpTriggerExecution.findUnique({
              where: { id: input.httpTriggerExecutionId! },
              select: { cancelledAt: true },
            })
          : await tx.manualPipelineExecution.findUnique({
              where: { id: input.manualExecutionId! },
              select: { cancelledAt: true },
            });

    const allJobs =
      executionKind === "schedule"
        ? await tx.agentJobExecution.findMany({
            where: { scheduleExecutionId: input.scheduleExecutionId! },
            select: { status: true, error: true },
          })
        : executionKind === "httpTrigger"
          ? await tx.agentJobExecution.findMany({
              where: { httpTriggerExecutionId: input.httpTriggerExecutionId! },
              select: { status: true, error: true },
            })
          : await tx.agentJobExecution.findMany({
              where: { manualExecutionId: input.manualExecutionId! },
              select: { status: true, error: true },
            });

    const run = executionRow?.cancelledAt
      ? resolveRunStatusForSettledCancelledExecution(allJobs)
      : runStatusToPrisma(
          computeExecutionRunStatusFromStepRollups(
            allSteps.map((s) => prismaRollupToTerminal(s.rollupStatus)),
            config.stepRollupPolicy,
          ),
        );

    if (executionKind === "schedule") {
      await tx.scheduleExecution.updateMany({
        where: {
          id: input.scheduleExecutionId,
          runStatus: {
            in: [ScheduleRunStatus.pending, ScheduleRunStatus.running],
          },
        },
        data: { runStatus: run },
      });
    } else if (executionKind === "httpTrigger") {
      await tx.httpTriggerExecution.updateMany({
        where: {
          id: input.httpTriggerExecutionId,
          runStatus: {
            in: [ScheduleRunStatus.pending, ScheduleRunStatus.running],
          },
        },
        data: { runStatus: run },
      });
    } else {
      await tx.manualPipelineExecution.updateMany({
        where: {
          id: input.manualExecutionId,
          runStatus: {
            in: [ScheduleRunStatus.pending, ScheduleRunStatus.running],
          },
        },
        data: { runStatus: run },
      });
    }
  });
};

function prismaRollupToTerminal(
  r: ScheduleStepRollupStatus,
): StepRollupTerminal {
  switch (r) {
    case ScheduleStepRollupStatus.success:
      return "success";
    case ScheduleStepRollupStatus.partial:
      return "partial";
    case ScheduleStepRollupStatus.failed:
    case ScheduleStepRollupStatus.skipped:
    case ScheduleStepRollupStatus.cancelled:
      return "failed";
    default:
      return "failed";
  }
}

function runStatusToPrisma(
  r: "succeeded" | "partial" | "failed",
): ScheduleRunStatus {
  switch (r) {
    case "succeeded":
      return ScheduleRunStatus.succeeded;
    case "partial":
      return ScheduleRunStatus.partial;
    case "failed":
      return ScheduleRunStatus.failed;
  }
}
