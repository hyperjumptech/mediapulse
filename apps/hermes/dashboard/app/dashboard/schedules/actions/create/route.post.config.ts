import type { Prisma } from "@hermes/orchestration-database";
import { prisma } from "@hermes/orchestration-database";
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

/**
 * Parses optional JSON string into plain object or null for retryConfig.
 */
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
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    repeat: z.enum(["once", "repeating"]),
    cronExpression: z.string().optional().nullable(),
    interval: z.coerce.number().int().positive().optional().nullable(),
    timezone: z.string().min(1, "Timezone is required"),
    startAt: z.coerce.date().optional().nullable(),
    pipelineId: z.string().uuid(),
    retryConfig: retryConfigSchema,
    executionConfig: retryConfigSchema,
    timeout: z
      .union([z.literal(""), z.coerce.number()])
      .optional()
      .nullable()
      .transform((v): number | null => {
        if (v === "" || v === undefined || v === null) return null;
        const n = Number(v);
        return n > 0 ? n : null;
      }),
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
      if (data.repeat !== "repeating") return true;
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

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardSessionForRoute,
});

export const responseValidator = z.object({
  id: z.string().uuid(),
});

type CreateScheduleHandlerDependencies = {
  db?: typeof prisma;
};

type CreateScheduleHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Computes nextRunAt for a schedule: for "once" use startAt; for "repeating" use computeNextRunAt.
 *
 * @param repeat - Schedule repeat type.
 * @param startAt - Optional start date.
 * @param cronExpression - Optional cron (repeating).
 * @param interval - Optional interval ms (repeating).
 * @param timezone - Timezone string.
 * @returns Next run date or null.
 */
const computeNextRun = (
  repeat: "once" | "repeating",
  startAt: Date | null | undefined,
  cronExpression: string | null | undefined,
  interval: number | null | undefined,
  timezone: string,
): Date | null => {
  if (repeat === "once") return startAt ?? null;
  const after = startAt ?? new Date();
  return computeNextRunAt(
    {
      repeat: "repeating",
      cronExpression: cronExpression ?? null,
      interval: interval ?? null,
      timezone,
      nextRunAt: null,
    },
    after,
  );
};

/**
 * Creates the create-schedule handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional db client for tests.
 * @returns Handler that creates a schedule and returns its id.
 */
export const createCreateScheduleHandler = ({
  db = prisma,
}: CreateScheduleHandlerDependencies = {}): CreateScheduleHandler => {
  return async (data) => {
    const userId = data.user.id;
    const body = data.body;

    const pipeline = await getPipelineWithSteps(body.pipelineId, db);
    if (!pipeline) {
      return errorResponse("Pipeline not found");
    }
    const validation = await validatePipeline(pipeline, db);
    if (getPipelineStatus(pipeline, validation) !== "enabled") {
      return errorResponse(
        "Pipeline must be enabled to create a schedule. Complete step input and config and ensure the pipeline is active.",
      );
    }

    const nextRunAt = computeNextRun(
      body.repeat,
      body.startAt ?? null,
      body.cronExpression ?? null,
      body.interval ?? null,
      body.timezone,
    );

    if (body.executionConfig != null) {
      ExecutionConfigSchema.parse(body.executionConfig);
    }

    const schedule = await db.schedule.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        repeat: body.repeat,
        cronExpression: body.cronExpression ?? null,
        interval: body.interval ?? null,
        timezone: body.timezone,
        startAt: body.startAt ?? null,
        nextRunAt,
        pipelineId: body.pipelineId,
        retryConfig:
          body.retryConfig != null
            ? (body.retryConfig as Prisma.InputJsonValue)
            : undefined,
        executionConfig:
          body.executionConfig != null
            ? (body.executionConfig as Prisma.InputJsonValue)
            : undefined,
        timeout: body.timeout ?? null,
        priority: body.priority ?? 0,
        enabled: body.enabled ?? true,
        createdById: userId,
      },
    });

    return successResponse({ id: schedule.id });
  };
};

/**
 * Handles create schedule: validates session, pipeline, and creates schedule.
 */
export const handler: CreateScheduleHandler = createCreateScheduleHandler();
