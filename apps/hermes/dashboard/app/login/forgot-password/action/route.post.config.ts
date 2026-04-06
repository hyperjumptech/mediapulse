import { prismaClient } from "@hermes/orchestration-database/client";
import type { Prisma } from "@hermes/orchestration-database";
import { UserRole } from "@hermes/orchestration-database";
import { env } from "@hermes/env";
import { Resend } from "resend";
import {
  createRequestValidator,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import {
  generateHermesAdminResetToken,
  HERMES_ADMIN_RESET_TOKEN_TTL_MS,
} from "@/lib/hermes-admin-reset-token";

/** Prefix for server logs when Resend or the mail path fails (stderr / Docker / Vercel logs). */
const FORGOT_PASSWORD_LOG_PREFIX = "[hermes-dashboard:forgot-password]";

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
    console.log(
      FORGOT_PASSWORD_LOG_PREFIX,
      "Resend credentials missing; skipping email.",
      input.to,
      input.resetUrl,
    );
    return;
  }

  const resend = new Resend(apiKey);
  const subject = "Reset your Hermes admin password";
  const text = [
    "You requested a password reset for your Hermes admin account.",
    "",
    `Open this link to choose a new password (valid for 1 hour):`,
    input.resetUrl,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  const html = `<p>You requested a password reset for your Hermes admin account.</p>
<p><a href="${input.resetUrl}">Reset your password</a> (link valid for 1 hour).</p>
<p>If you did not request this, you can ignore this email.</p>`;

  const result = await resend.emails.send({
    from,
    to: input.to,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }
};

type ForgotPasswordHandlerDependencies = {
  db?: DbClient;
  getPublicBaseUrl?: () => string;
  generateToken?: typeof generateHermesAdminResetToken;
  now?: () => number;
  sendResetEmail?: SendHermesAdminPasswordResetEmail;
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
 * If sending mail fails, the response stays generic while the error is logged server-side (prefix `[hermes-dashboard:forgot-password]`).
 *
 * @param dependencies - DB, URL builder, Resend email, and clock for tests.
 */
export const createForgotPasswordHandler = ({
  db = prismaClient,
  getPublicBaseUrl = () => env.HERMES_DASHBOARD_PUBLIC_URL,
  generateToken = generateHermesAdminResetToken,
  now = () => Date.now(),
  sendResetEmail = sendHermesAdminPasswordResetEmailDefault,
}: ForgotPasswordHandlerDependencies = {}): ForgotPasswordHandler => {
  return async (data) => {
    const emailNormalized = data.body.email.trim().toLowerCase();

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

      const resetUrl = buildHermesAdminResetPasswordUrl(
        getPublicBaseUrl(),
        rawToken,
      );

      try {
        await sendResetEmail({ to: user.email, resetUrl });
      } catch (error: unknown) {
        // Client always gets generic success (anti-enumeration); log for ops/debugging.
        console.error(
          FORGOT_PASSWORD_LOG_PREFIX,
          "Failed to send Hermes admin password reset email.",
          { userId: user.id },
          error,
        );
      }
    }

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles forgot-password: request a reset link (anti-enumerating response).
 */
export const handler: ForgotPasswordHandler = createForgotPasswordHandler();
