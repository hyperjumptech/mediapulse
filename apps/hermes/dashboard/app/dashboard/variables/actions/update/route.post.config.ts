import { prisma, type Prisma } from "@hermes/orchestration-database";
import { env } from "@hermes/env";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireMutationDashboardPrincipalForRoute } from "@/lib/require-mutation-dashboard-principal-for-route";
import {
  encryptSecretVariableForPayload,
  fromStoredSecretVariableValue,
  SECRET_MASK,
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
  user: requireMutationDashboardPrincipalForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type UpdateVariableHandlerDependencies = {
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
 * @param dependencies - Optional db client for tests.
 * @returns Handler that updates a variable (key, value, note, isSecret).
 */
export const createUpdateVariableHandler = ({
  db = prisma,
}: UpdateVariableHandlerDependencies = {}): UpdateVariableHandler => {
  return async (data) => {
    const { id, key, value, note, isSecret } = data.body;

    const existing = await db.variable.findUnique({
      where: { id },
      include: { encryptedPayload: true },
    });
    if (!existing) {
      return errorResponse("Variable not found");
    }

    const updateData: Prisma.VariableUpdateInput = {};

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
        updateData.value = "";
        updateData.encryptedPayload = {
          upsert: {
            create: {
              ciphertext: encryptSecretVariableForPayload(
                value,
                env.HERMES_INTERNAL_API_KEY,
              ),
            },
            update: {
              ciphertext: encryptSecretVariableForPayload(
                value,
                env.HERMES_INTERNAL_API_KEY,
              ),
            },
          },
        };
      } else if (!existing.isSecret) {
        updateData.value = "";
        updateData.encryptedPayload = {
          upsert: {
            create: {
              ciphertext: encryptSecretVariableForPayload(
                existing.value,
                env.HERMES_INTERNAL_API_KEY,
              ),
            },
            update: {
              ciphertext: encryptSecretVariableForPayload(
                existing.value,
                env.HERMES_INTERNAL_API_KEY,
              ),
            },
          },
        };
      }
    } else if (existing.isSecret) {
      updateData.value = hasReplacementValue
        ? value
        : fromStoredSecretVariableValue(
            existing.encryptedPayload?.ciphertext ?? "",
            env.HERMES_INTERNAL_API_KEY,
            env.HERMES_INTERNAL_API_KEY_PREVIOUS,
          );
      if (existing.encryptedPayload) {
        updateData.encryptedPayload = { delete: true };
      }
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
