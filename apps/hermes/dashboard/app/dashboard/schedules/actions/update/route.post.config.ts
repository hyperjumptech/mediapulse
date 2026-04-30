import { prisma, Prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireDashboardSessionForRoute } from "@/lib/auth-dashboard";
import { getPipelineWithSteps } from "@/lib/pipelines";
import { getPipelineStatus, validatePipeline } from "@/lib/validate-pipeline";
import { computeNextRunAt, ExecutionConfigSchema } from "@hermes/scheduler";

const retryConfigSchema = z
  .union([
    z.record(z.unknown()).nullable(),
    z
      .string()
      .optional()
      .transform((s): Record<string, unknown> | null => {
        if (s === undefined || s === null || s === "") return null;
        try {
          const v = JSON.parse(s) as unknown;
          if (v === null) return null;
          if (typeof v === "object" && !Array.isArray(v))
            return v as Record<string, unknown>;
          throw new Error("retryConfig must be JSON object or null");
        } catch (err) {
          throw err instanceof Error ? err : new Error("Invalid JSON");
        }
      }),
  ])
  .nullable()
  .optional();

const bodyValidator = z
  .object({
    scheduleId: z.string().uuid(),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    repeat: z.enum(["once", "repeating"]).optional(),
    cronExpression: z.string().optional().nullable(),
    interval: z.coerce.number().int().positive().optional().nullable(),
    timezone: z.string().min(1).optional(),
    startAt: z.coerce.date().optional().nullable(),
    pipelineId: z.string().uuid().optional(),
    retryConfig: retryConfigSchema,
    executionConfig: retryConfigSchema,
    priority: z.coerce.number().int().optional(),
    enabled: z
      .union([z.boolean(), z.literal("on"), z.literal("false")])
      .optional()
      .transform((v) =>
        v === true || v === "on" ? true : v === "false" ? false : undefined,
      ),
  })
  .refine(
    (data) => {
      const repeat = data.repeat;
      if (repeat !== "repeating") return true;
      return (
        (data.cronExpression != null && data.cronExpression.trim() !== "") ||
        (typeof data.interval === "number" && data.interval > 0)
      );
    },
    {
      message:
        "Repeating schedules require either cron expression or interval (ms)",
      path: ["repeat"],
    },
  );

/**
 * Returns true when the provided cron expression yields a next run for the timezone.
 *
 * @param cronExpression - Candidate cron expression.
 * @param timezone - IANA timezone string.
 * @param startAt - Optional starting point for next-run calculation.
 * @returns True when cron can be parsed into a next run.
 */
const isValidRepeatingCron = (
  cronExpression: string | null | undefined,
  timezone: string,
  startAt: Date | null | undefined,
): boolean => {
  if (cronExpression == null || cronExpression.trim() === "") {
    return true;
  }
  return (
    computeNextRunAt(
      {
        repeat: "repeating",
        cronExpression: cronExpression.trim(),
        interval: null,
        timezone,
        nextRunAt: null,
      },
      startAt ?? new Date(),
    ) !== null
  );
};

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type UpdateScheduleHandlerDependencies = {
  db?: typeof prisma;
};

type UpdateScheduleHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the update-schedule handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional db client for tests.
 * @returns Handler that updates a schedule.
 */
export const createUpdateScheduleHandler = ({
  db = prisma,
}: UpdateScheduleHandlerDependencies = {}): UpdateScheduleHandler => {
  return async (data) => {
    const body = data.body;
    const existing = await db.schedule.findUnique({
      where: { id: body.scheduleId },
    });
    if (!existing) {
      return errorResponse("Schedule not found");
    }

    if (body.executionConfig != null) {
      ExecutionConfigSchema.parse(body.executionConfig);
    }

    if (body.pipelineId != null) {
      const pipeline = await getPipelineWithSteps(body.pipelineId, db);
      if (!pipeline) {
        return errorResponse("Pipeline not found");
      }
      const validation = await validatePipeline(pipeline, db);
      if (getPipelineStatus(pipeline, validation) !== "enabled") {
        return errorResponse(
          "Pipeline must be enabled to assign to a schedule. Complete step input and config and ensure the pipeline is active.",
        );
      }
    }

    const repeat = body.repeat ?? existing.repeat;
    const timezone = body.timezone ?? existing.timezone;
    const startAt =
      body.startAt !== undefined ? body.startAt : existing.startAt;
    const cronExpression =
      body.cronExpression !== undefined
        ? body.cronExpression
        : existing.cronExpression;
    const interval =
      body.interval !== undefined ? body.interval : existing.interval;

    if (repeat === "once" && startAt == null) {
      return errorResponse("One-time schedules require a start date/time.");
    }
    if (
      repeat === "repeating" &&
      !isValidRepeatingCron(cronExpression, timezone, startAt)
    ) {
      return errorResponse(
        "Invalid cron expression for the selected timezone.",
      );
    }

    let nextRunAt: Date | null = existing.nextRunAt;
    if (repeat === "once") {
      nextRunAt = startAt ?? null;
    } else {
      const computed = computeNextRunAt(
        {
          repeat: "repeating",
          cronExpression,
          interval,
          timezone,
          nextRunAt: existing.nextRunAt,
        },
        startAt ?? new Date(),
      );
      nextRunAt = computed ?? existing.nextRunAt;
    }
    if (repeat === "repeating" && nextRunAt == null) {
      return errorResponse(
        "Unable to compute next run. Provide a valid cron or interval.",
      );
    }

    const updateData: Prisma.ScheduleUpdateInput = {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.repeat !== undefined && { repeat: body.repeat }),
      ...(body.cronExpression !== undefined && {
        cronExpression: body.cronExpression,
      }),
      ...(body.interval !== undefined && { interval: body.interval }),
      ...(body.timezone !== undefined && { timezone: body.timezone }),
      ...(body.startAt !== undefined && { startAt: body.startAt }),
      ...(body.pipelineId !== undefined && { pipelineId: body.pipelineId }),
      ...(body.retryConfig !== undefined && {
        retryConfig:
          body.retryConfig != null
            ? (body.retryConfig as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      }),
      ...(body.executionConfig !== undefined && {
        executionConfig:
          body.executionConfig != null
            ? (body.executionConfig as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.enabled !== undefined && { enabled: body.enabled }),
      nextRunAt,
    };

    await db.schedule.update({
      where: { id: body.scheduleId },
      data: updateData,
    });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles update schedule: validates session, loads schedule, updates and recomputes nextRunAt.
 */
export const handler: UpdateScheduleHandler = createUpdateScheduleHandler();
