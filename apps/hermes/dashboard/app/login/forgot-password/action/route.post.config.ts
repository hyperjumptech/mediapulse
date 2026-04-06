import { prismaClient } from "@hermes/orchestration-database/client";
import type { Prisma } from "@hermes/orchestration-database";
import { UserRole } from "@hermes/orchestration-database";
import { env } from "@hermes/env";
import { logger } from "@workspace/logger";
import { Resend } from "resend";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { buildHermesAdminPasswordResetEmailContent } from "@/lib/hermes-admin-password-reset-email-content";
import {
  generateHermesAdminResetToken,
  HERMES_ADMIN_RESET_TOKEN_TTL_MS,
} from "@/lib/hermes-admin-reset-token";
import { checkMemorySlidingRateLimit } from "@/lib/memory-sliding-rate-limit";

const bodyValidator = z.object({
  email: z.string().email(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type ForgotPasswordHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

type DbClient = Pick<
  typeof prismaClient,
  "user" | "hermesAdminPasswordResetToken"
>;

export type SendHermesAdminPasswordResetEmail = (input: {
  to: string;
  resetUrl: string;
}) => Promise<void>;

/**
 * Sends the password-reset email via Resend. No-ops when API credentials are missing (local dev).
 *
 * @param input - Recipient and absolute reset URL.
 */
export const sendHermesAdminPasswordResetEmailDefault = async (input: {
  to: string;
  resetUrl: string;
}): Promise<void> => {
  const apiKey = env.HERMES_RESEND_API_KEY;
  const from = env.HERMES_RESEND_FROM;
  if (!apiKey?.trim() || !from?.trim()) {
    logger.debug(
      { event: "hermes_admin_forgot_password_email_skipped_no_resend" },
      "hermes_admin_forgot_password_email_skipped_no_resend",
    );
    return;
  }

  const resend = new Resend(apiKey);
  const { subject, text, html } = buildHermesAdminPasswordResetEmailContent(
    input.resetUrl,
  );

  const result = await resend.emails.send({
    from,
    to: input.to,
    subject,
    text,
    html,
  });

  if (result.error) {
    logger.warn(
      {
        event: "hermes_admin_forgot_password_resend_error",
        resendMessage: result.error.message,
      },
      "hermes_admin_forgot_password_resend_error",
    );
    throw new Error(result.error.message);
  }

  logger.info(
    { event: "hermes_admin_forgot_password_email_sent" },
    "hermes_admin_forgot_password_email_sent",
  );
};

/** Default: 5 submissions per 15 minutes per normalized email (in-process only). */
export const checkHermesForgotPasswordRateLimitDefault = (
  emailNormalized: string,
): boolean =>
  checkMemorySlidingRateLimit(`hermes-pw-forgot:${emailNormalized}`, {
    windowMs: 15 * 60 * 1000,
    max: 5,
  });

type ForgotPasswordHandlerDependencies = {
  db?: DbClient;
  getPublicBaseUrl?: () => string;
  generateToken?: typeof generateHermesAdminResetToken;
  now?: () => number;
  sendResetEmail?: SendHermesAdminPasswordResetEmail;
  checkForgotRateLimit?: (emailNormalized: string) => boolean;
};

/**
 * Builds the public reset URL for an opaque raw token (no PII in the path beyond the secret).
 *
 * @param publicBaseUrl - `HERMES_DASHBOARD_PUBLIC_URL` without trailing slash.
 * @param rawToken - Raw token from {@link generateHermesAdminResetToken}.
 * @returns Absolute HTTPS (or dev HTTP) URL.
 */
export const buildHermesAdminResetPasswordUrl = (
  publicBaseUrl: string,
  rawToken: string,
): string => {
  const base = publicBaseUrl.replace(/\/$/, "");
  const q = new URLSearchParams({ token: rawToken });
  return `${base}/reset-password?${q.toString()}`;
};

/**
 * Creates the forgot-password handler: always returns success; sends email only for active admins.
 *
 * @param dependencies - DB, URL builder, Resend email, and clock for tests.
 */
export const createForgotPasswordHandler = ({
  db = prismaClient,
  getPublicBaseUrl = () =>
    env.HERMES_DASHBOARD_PUBLIC_URL ?? "http://localhost:3001",
  generateToken = generateHermesAdminResetToken,
  now = () => Date.now(),
  sendResetEmail = sendHermesAdminPasswordResetEmailDefault,
  checkForgotRateLimit = checkHermesForgotPasswordRateLimitDefault,
}: ForgotPasswordHandlerDependencies = {}): ForgotPasswordHandler => {
  return async (data) => {
    const emailNormalized = data.body.email.trim().toLowerCase();

    if (!checkForgotRateLimit(emailNormalized)) {
      logger.warn(
        { event: "hermes_admin_forgot_password_rate_limited" },
        "hermes_admin_forgot_password_rate_limited",
      );
      return errorResponse(
        "Too many requests. Please wait before trying again.",
      );
    }

    const args = {
      where: { email: emailNormalized },
    } satisfies Prisma.UserFindUniqueArgs;

    const user = await db.user.findUnique(args);

    if (user && user.role === UserRole.ADMIN && user.isActive === true) {
      const { rawToken, tokenHash } = generateToken();
      const expiresAt = new Date(now() + HERMES_ADMIN_RESET_TOKEN_TTL_MS);

      await db.hermesAdminPasswordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      logger.info(
        { event: "hermes_admin_forgot_password_token_created" },
        "hermes_admin_forgot_password_token_created",
      );

      const resetUrl = buildHermesAdminResetPasswordUrl(
        getPublicBaseUrl(),
        rawToken,
      );

      try {
        await sendResetEmail({ to: user.email, resetUrl });
      } catch (err) {
        logger.warn(
          { event: "hermes_admin_forgot_password_email_failed", err },
          "hermes_admin_forgot_password_email_failed",
        );
        // Intentionally generic client response; do not leak email existence.
      }
    }

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles forgot-password: request a reset link (anti-enumerating response).
 */
export const handler: ForgotPasswordHandler = createForgotPasswordHandler();
