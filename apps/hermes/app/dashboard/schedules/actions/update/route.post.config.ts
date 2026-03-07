import { prisma, Prisma } from "@workspace/database";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import {
  getDashboardSession,
  getDashboardSessionForRoute,
} from "@/lib/auth-dashboard";
import { computeNextRunAt } from "@workspace/hermes-scheduler";

const paramsSchema = z
  .union([
    z.record(z.unknown()),
    z
      .string()
      .optional()
      .transform((s): Record<string, unknown> => {
        if (s === undefined || s === null || s === "") return {};
        try {
          const v = JSON.parse(s) as unknown;
          if (typeof v === "object" && v !== null && !Array.isArray(v))
            return v as Record<string, unknown>;
          return {};
        } catch {
          throw new Error("params must be valid JSON object");
        }
      }),
  ])
  .optional();

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
    params: paramsSchema,
    retryConfig: retryConfigSchema,
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

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type UpdateScheduleHandlerDependencies = {
  getSession?: typeof getDashboardSession;
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
 * @param dependencies - Optional getSession and db.
 * @returns Handler that updates a schedule.
 */
export const createUpdateScheduleHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: UpdateScheduleHandlerDependencies = {}): UpdateScheduleHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const body = data.body;
    const existing = await db.schedule.findUnique({
      where: { id: body.scheduleId },
    });
    if (!existing) {
      return errorResponse("Schedule not found");
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
      ...(body.params !== undefined && {
        params: body.params as Prisma.InputJsonValue,
      }),
      ...(body.retryConfig !== undefined && {
        retryConfig:
          body.retryConfig != null
            ? (body.retryConfig as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      }),
      ...(body.timeout !== undefined && { timeout: body.timeout }),
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
