import { prismaClient } from "@hermes/orchestration-database/client";
import { logger } from "@workspace/logger";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { hashHermesAdminResetToken } from "@/lib/hermes-admin-reset-token";
import { lookupHermesAdminResetToken } from "@/lib/lookup-hermes-admin-reset-token";
import { checkMemorySlidingRateLimit } from "@/lib/memory-sliding-rate-limit";
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

/** Default: 25 attempts per 15 minutes per token hash (in-process only). */
export const checkHermesResetPasswordRateLimitDefault = (
  rawToken: string,
): boolean =>
  checkMemorySlidingRateLimit(
    `hermes-pw-reset:${hashHermesAdminResetToken(rawToken)}`,
    {
      windowMs: 15 * 60 * 1000,
      max: 25,
    },
  );

type CompleteResetDependencies = {
  db?: typeof prismaClient;
  checkResetRateLimit?: (rawToken: string) => boolean;
};

/**
 * Completes self-service password reset using the raw token from the email link.
 *
 * @param dependencies - Injectable Prisma client for tests.
 */
export const createCompleteSelfServicePasswordResetHandler = ({
  db = prismaClient,
  checkResetRateLimit = checkHermesResetPasswordRateLimitDefault,
}: CompleteResetDependencies = {}): CompleteResetHandler => {
  return async (data) => {
    const { token, newPassword } = data.body;

    if (!checkResetRateLimit(token)) {
      logger.warn(
        { event: "hermes_admin_reset_password_rate_limited" },
        "hermes_admin_reset_password_rate_limited",
      );
      return errorResponse(
        "Too many requests. Please wait before trying again.",
      );
    }

    const resolved = await lookupHermesAdminResetToken(db, token);
    if (!resolved.ok) {
      logger.warn(
        {
          event: "hermes_admin_reset_password_rejected",
          reason: resolved.reason,
        },
        "hermes_admin_reset_password_rejected",
      );
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
    } catch (err) {
      logger.error(
        { event: "hermes_admin_reset_password_transaction_failed", err },
        "hermes_admin_reset_password_transaction_failed",
      );
      return errorResponse(genericInvalidMessage);
    }

    logger.info(
      { event: "hermes_admin_reset_password_completed" },
      "hermes_admin_reset_password_completed",
    );

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles self-service password reset after a valid email link token.
 */
export const handler: CompleteResetHandler =
  createCompleteSelfServicePasswordResetHandler();
