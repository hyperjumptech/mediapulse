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
  computeStepRollupFromCounts,
  type StepRollupTerminal,
} from "./schedule-rollup";

export type InvocationCompletionInput = {
  jobId: string;
  scheduleExecutionId?: string;
  httpTriggerExecutionId?: string;
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

const defaultExecutionConfig = (): ExecutionConfig => ({
  schemaVersion: 1,
  stepRollupPolicy: "strict",
  stepOrder: "sequential",
  continueSequentialAfterPartial: false,
});

const loadExecutionConfig = (
  raw: Prisma.JsonValue | null | undefined,
  logger: ApplyInvocationCompletionDeps["logger"],
  scheduleExecutionId: string,
): ExecutionConfig => {
  try {
    const obj =
      raw != null && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    return parseEffectiveExecutionConfig(obj);
  } catch (err) {
    logger.error(
      { err, scheduleExecutionId },
      "applyInvocationCompletion: invalid effectiveExecutionConfig",
    );
    return defaultExecutionConfig();
  }
};

/**
 * Updates `AgentJobExecution`, increments step counters, recomputes step rollup, and idempotently
 * updates `ScheduleExecution.runStatus` when all step rows are terminal (PRD §7.2).
 *
 * @param input - Terminal state for one invocation.
 * @param deps - DB client and logger.
 */
export const applyInvocationCompletion = async (
  input: InvocationCompletionInput,
  deps: ApplyInvocationCompletionDeps,
): Promise<void> => {
  const { db, logger } = deps;

  const executionKind = input.scheduleExecutionId ? "schedule" : "httpTrigger";
  const execution = input.scheduleExecutionId
    ? await db.scheduleExecution.findUnique({
        where: { id: input.scheduleExecutionId },
        select: {
          id: true,
          runStatus: true,
          effectiveExecutionConfig: true,
        },
      })
    : input.httpTriggerExecutionId
      ? await db.httpTriggerExecution.findUnique({
          where: { id: input.httpTriggerExecutionId },
          select: {
            id: true,
            runStatus: true,
            effectiveExecutionConfig: true,
          },
        })
      : null;
  if (!execution) {
    logger.warn(
      {
        scheduleExecutionId: input.scheduleExecutionId,
        httpTriggerExecutionId: input.httpTriggerExecutionId,
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

  const config = loadExecutionConfig(
    execution.effectiveExecutionConfig,
    logger,
    input.scheduleExecutionId ?? input.httpTriggerExecutionId ?? "unknown",
  );

  const isSuccess = input.terminal.status === AgentJobExecutionStatus.completed;
  const agentData =
    input.terminal.status === AgentJobExecutionStatus.completed
      ? {
          status: AgentJobExecutionStatus.completed,
          completedAt: new Date(),
          error: Prisma.DbNull,
          agentResponse: input.terminal
            .envelope as unknown as Prisma.InputJsonValue,
          semanticStatus: input.terminal.envelope.status,
        }
      : {
          status: AgentJobExecutionStatus.failed,
          completedAt: new Date(),
          error: input.terminal.error,
          agentResponse: input.terminal.agentResponse ?? Prisma.DbNull,
          semanticStatus: input.terminal.semanticStatus ?? null,
        };

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
    } else {
      await tx.httpTriggerExecution.update({
        where: { id: input.httpTriggerExecutionId },
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
        : await tx.httpTriggerStepExecution.findUnique({
            where: {
              httpTriggerExecutionId_pipelineStepId: {
                httpTriggerExecutionId: input.httpTriggerExecutionId!,
                pipelineStepId: input.pipelineStepId,
              },
            },
          });
    if (!stepRow) {
      return;
    }

    const inc = isSuccess
      ? { succeededCount: { increment: 1 } }
      : { failedCount: { increment: 1 } };

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
        : await tx.httpTriggerStepExecution.update({
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

    const rollupTerminal = computeStepRollupFromCounts(
      updated.succeededCount,
      updated.failedCount,
      config.stepRollupPolicy,
    );

    if (executionKind === "schedule") {
      await tx.scheduleStepExecution.update({
        where: { id: stepRow.id },
        data: { rollupStatus: stepRollupTerminalToPrisma(rollupTerminal) },
      });
    } else {
      await tx.httpTriggerStepExecution.update({
        where: { id: stepRow.id },
        data: { rollupStatus: stepRollupTerminalToPrisma(rollupTerminal) },
      });
    }

    const allSteps =
      executionKind === "schedule"
        ? await tx.scheduleStepExecution.findMany({
            where: { scheduleExecutionId: input.scheduleExecutionId! },
            select: { rollupStatus: true },
          })
        : await tx.httpTriggerStepExecution.findMany({
            where: { httpTriggerExecutionId: input.httpTriggerExecutionId! },
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

    const stepTerminals: StepRollupTerminal[] = allSteps.map((s) =>
      prismaRollupToTerminal(s.rollupStatus),
    );
    const run = computeExecutionRunStatusFromStepRollups(
      stepTerminals,
      config.stepRollupPolicy,
    );

    if (executionKind === "schedule") {
      await tx.scheduleExecution.updateMany({
        where: {
          id: input.scheduleExecutionId,
          runStatus: {
            in: [ScheduleRunStatus.pending, ScheduleRunStatus.running],
          },
        },
        data: { runStatus: runStatusToPrisma(run) },
      });
    } else {
      await tx.httpTriggerExecution.updateMany({
        where: {
          id: input.httpTriggerExecutionId,
          runStatus: {
            in: [ScheduleRunStatus.pending, ScheduleRunStatus.running],
          },
        },
        data: { runStatus: runStatusToPrisma(run) },
      });
    }
  });
};

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
