/**
 * Shared helpers for table-v1 `reset-all` danger-confirm custom actions.
 */

import type { DashboardPageCustomAction } from "@hermes/domain-contract";
import { Prisma } from "@mediapulse/database";
import type { Handler } from "hono";
import { z } from "zod";

/** Prisma error code for foreign-key constraint violations. */
const PRISMA_FOREIGN_KEY_VIOLATION = "P2003";

type ResetAllActionManifestInput = Omit<
  DashboardPageCustomAction,
  "id" | "path" | "ui" | "method"
> & {
  confirmToken: string;
};

type ResetAllHandlerInput = {
  confirmToken: string;
  deleteAll: () => Promise<{ count: number }>;
  blockedMessage?: string;
};

/**
 * Builds the strict Zod schema for a reset-all POST body.
 *
 * @param confirmToken - Literal token the client must send.
 */
const buildResetAllBodySchema = (confirmToken: string) =>
  z
    .object({
      confirm: z.literal(confirmToken),
    })
    .strict();

/**
 * Returns true when an error is a Prisma foreign-key violation.
 *
 * @param error - Caught error from a delete operation.
 */
export const isPrismaForeignKeyViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === PRISMA_FOREIGN_KEY_VIOLATION;

/**
 * Creates a Hono POST handler that deletes all rows after confirm-token validation.
 *
 * @param input - Confirm token, delete delegate, and optional FK-blocked message.
 * @returns POST handler returning `{ deleted: number }`.
 */
export const createResetAllPostHandler = ({
  confirmToken,
  deleteAll,
  blockedMessage = "Cannot delete rows while other records still reference them.",
}: ResetAllHandlerInput): Handler => {
  const bodySchema = buildResetAllBodySchema(confirmToken);

  return async (c) => {
    let jsonBody: unknown;
    try {
      jsonBody = await c.req.json();
    } catch {
      return c.json({ message: "Invalid JSON" }, 400);
    }

    const parsed = bodySchema.safeParse(jsonBody);
    if (!parsed.success) {
      return c.json({ message: "Invalid request body" }, 400);
    }

    try {
      const result = await deleteAll();
      return c.json({ deleted: result.count });
    } catch (error) {
      if (isPrismaForeignKeyViolation(error)) {
        return c.json({ message: blockedMessage }, 409);
      }
      throw error;
    }
  };
};

/**
 * Builds manifest metadata for a standard reset-all danger-confirm action.
 *
 * @param input - Label, description, confirm copy, and token.
 * @returns Manifest fields excluding `id`, `path`, `ui`, and `method`.
 */
export const buildResetAllActionManifest = (
  input: ResetAllActionManifestInput,
): Omit<DashboardPageCustomAction, "id" | "path"> => ({
  ...input,
  ui: "danger-confirm",
  method: "POST",
});
