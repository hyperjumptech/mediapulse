import { prismaClient } from "@hermes/orchestration-database/client";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { lookupHermesAdminResetToken } from "@/lib/lookup-hermes-admin-reset-token";
import { updateHermesAdminPasswordWithCredentialBump } from "@/lib/update-hermes-admin-password";

const bodyValidator = z
  .object({
    token: z.string().min(1),
    newPassword: z.string().min(4),
    confirmPassword: z.string().min(4),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const requestValidator = createRequestValidator({
  body: bodyValidator,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type CompleteResetHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

const genericInvalidMessage = "Invalid or expired reset link.";

type CompleteResetDependencies = {
  db?: typeof prismaClient;
};

/**
 * Completes self-service password reset using the raw token from the email link.
 *
 * @param dependencies - Injectable Prisma client for tests.
 */
export const createCompleteSelfServicePasswordResetHandler = ({
  db = prismaClient,
}: CompleteResetDependencies = {}): CompleteResetHandler => {
  return async (data) => {
    const { token, newPassword } = data.body;

    const resolved = await lookupHermesAdminResetToken(db, token);
    if (!resolved.ok) {
      return errorResponse(genericInvalidMessage);
    }

    try {
      await db.$transaction(async (tx) => {
        await updateHermesAdminPasswordWithCredentialBump(
          tx,
          resolved.userId,
          newPassword,
        );
        await tx.hermesAdminPasswordResetToken.update({
          where: { id: resolved.tokenId },
          data: { usedAt: new Date() },
        });
      });
    } catch {
      return errorResponse(genericInvalidMessage);
    }

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles self-service password reset after a valid email link token.
 */
export const handler: CompleteResetHandler =
  createCompleteSelfServicePasswordResetHandler();
