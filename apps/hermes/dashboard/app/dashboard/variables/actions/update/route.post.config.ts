import { prisma } from "@hermes/orchestration-database";
import { env } from "@hermes/env";
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
import {
  fromStoredSecretVariableValue,
  SECRET_MASK,
  toStoredVariableValue,
} from "@/lib/variables";

const bodyValidator = z.object({
  id: z.string().uuid(),
  key: z.string().min(1).optional(),
  value: z.string().optional(),
  note: z.string().optional().nullable(),
  isSecret: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional()
    .transform((v): boolean | undefined =>
      v === undefined ? undefined : v === true || v === "true",
    ),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type UpdateVariableHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
};

type UpdateVariableHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the update-variable handler with injectable dependencies for tests.
 * For secret variables, value is only updated when a new value is provided (not the mask placeholder).
 *
 * @param dependencies - Optional getSession and db.
 * @returns Handler that updates a variable (key, value, note, isSecret).
 */
export const createUpdateVariableHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: UpdateVariableHandlerDependencies = {}): UpdateVariableHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const { id, key, value, note, isSecret } = data.body;

    const existing = await db.variable.findUnique({
      where: { id },
    });
    if (!existing) {
      return errorResponse("Variable not found");
    }

    const updateData: {
      key?: string;
      value?: string;
      note?: string | null;
      isSecret?: boolean;
    } = {};

    if (key !== undefined) {
      updateData.key = key;
    }
    if (note !== undefined) {
      updateData.note = note;
    }
    const targetIsSecret = isSecret ?? existing.isSecret;
    if (isSecret !== undefined) {
      updateData.isSecret = isSecret;
    }
    const hasReplacementValue =
      value !== undefined && value !== SECRET_MASK && value.trim().length > 0;
    if (targetIsSecret) {
      if (hasReplacementValue) {
        updateData.value = toStoredVariableValue(
          value,
          true,
          env.HERMES_INTERNAL_API_KEY,
        );
      } else if (!existing.isSecret) {
        updateData.value = toStoredVariableValue(
          existing.value,
          true,
          env.HERMES_INTERNAL_API_KEY,
        );
      }
    } else if (existing.isSecret) {
      updateData.value = hasReplacementValue
        ? value
        : fromStoredSecretVariableValue(
            existing.value,
            env.HERMES_INTERNAL_API_KEY,
            env.HERMES_INTERNAL_API_KEY_PREVIOUS,
          );
    } else if (hasReplacementValue) {
      updateData.value = value;
    }

    await db.variable.update({
      where: { id },
      data: updateData,
    });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles update variable: validates session and updates key, value (if not mask), note, isSecret.
 */
export const handler: UpdateVariableHandler = createUpdateVariableHandler();
