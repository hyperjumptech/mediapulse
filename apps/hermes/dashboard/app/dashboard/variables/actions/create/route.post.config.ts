import { prisma } from "@hermes/orchestration-database";
import { env } from "@hermes/env";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireDashboardPrincipalForRoute } from "@/lib/auth-dashboard";
import {
  encryptSecretVariableForPayload,
  toStoredVariableValue,
} from "@/lib/variables";

const bodyValidator = z.object({
  key: z.string().min(1, "Key is required"),
  value: z.string(),
  note: z.string().optional(),
  isSecret: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional()
    .transform((v): boolean =>
      v === undefined ? false : v === true || v === "true",
    ),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardPrincipalForRoute,
});

export const responseValidator = z.object({
  id: z.string().uuid(),
});

type CreateVariableHandlerDependencies = {
  db?: typeof prisma;
};

type CreateVariableHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the create-variable handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional db client for tests.
 * @returns Handler that creates a variable (key, value, note, isSecret).
 */
export const createCreateVariableHandler = ({
  db = prisma,
}: CreateVariableHandlerDependencies = {}): CreateVariableHandler => {
  return async (data) => {
    const userId = data.user.id;
    const { key, value, note, isSecret } = data.body;
    const noteValue =
      note != null && String(note).trim().length > 0
        ? String(note).trim()
        : null;

    const existing = await db.variable.findUnique({
      where: { key },
    });
    if (existing) {
      return errorResponse(`Variable with key "${key}" already exists`);
    }

    const created = isSecret
      ? await db.variable.create({
          data: {
            key,
            value: toStoredVariableValue(value, true),
            note: noteValue,
            isSecret: true,
            createdById: userId,
            encryptedPayload: {
              create: {
                ciphertext: encryptSecretVariableForPayload(
                  value,
                  env.HERMES_INTERNAL_API_KEY,
                ),
              },
            },
          },
        })
      : await db.variable.create({
          data: {
            key,
            value: toStoredVariableValue(value, false),
            note: noteValue,
            isSecret: false,
            createdById: userId,
          },
        });

    return successResponse({ id: created.id });
  };
};

/**
 * Handles create variable: validates session and creates variable with key, value, optional note, isSecret.
 */
export const handler: CreateVariableHandler = createCreateVariableHandler();
