import { Resend } from "resend";
import { renderNewsletterEmail } from "@workspace/email-templates";
import {
  buildVCard,
  createRegistrationConfirmToken,
  formatResendSender,
  MEDIAPULSE_SENDER_NAME,
} from "@workspace/utils";
import { env } from "@mediapulse/env/app-user-registration";

type SendPendingConfirmationEmailInput = {
  to: string;
  name: string;
  tickerSymbol: string;
  userTickerId: string;
};

type SendEmail = (input: SendPendingConfirmationEmailInput) => Promise<void>;

/**
 * Builds the absolute confirmation URL for a signed registration token.
 *
 * @param token - Signed confirmation token.
 * @returns Absolute URL for the browser confirm route.
 */
export const buildRegistrationConfirmUrl = (token: string): string => {
  const base = env.USER_REGISTRATION_PUBLIC_URL.replace(/\/$/, "");
  return `${base}/api/confirm?token=${encodeURIComponent(token)}`;
};

/**
 * Sends the pending confirmation email via Resend.
 *
 * @param input - Recipient and subscription details.
 */
export const sendPendingConfirmationEmailDefault: SendEmail = async (input) => {
  const apiKey = env.USER_REGISTRATION_RESEND_API_KEY;
  const from = env.USER_REGISTRATION_RESEND_FROM;
  if (!apiKey.trim() || !from.trim()) {
    return;
  }

  const token = createRegistrationConfirmToken({
    userTickerId: input.userTickerId,
    tickerSymbol: input.tickerSymbol,
    secret: env.REGISTRATION_CONFIRM_SECRET,
  });
  const confirmUrl = buildRegistrationConfirmUrl(token);

  const { html, text } = await renderNewsletterEmail({
    variant: "registration-pending-confirmation",
    tickerSymbol: input.tickerSymbol,
    name: input.name,
    confirmUrl,
  });

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: formatResendSender(from),
    to: input.to,
    subject: "Confirm your MediaPulse subscription",
    html,
    text,
  });
};

/**
 * Sends the post-confirmation welcome email with vCard attachment.
 *
 * @param input - Recipient and ticker details.
 */
export const sendRegistrationConfirmedEmailDefault = async (input: {
  to: string;
  tickerSymbol: string;
}): Promise<void> => {
  const apiKey = env.USER_REGISTRATION_RESEND_API_KEY;
  const from = env.USER_REGISTRATION_RESEND_FROM;
  if (!apiKey.trim() || !from.trim()) {
    return;
  }

  const { html, text } = await renderNewsletterEmail({
    variant: "registration-confirmation",
    tickerSymbol: input.tickerSymbol,
  });

  const vcf = buildVCard({
    name: MEDIAPULSE_SENDER_NAME,
    email: env.NEXT_PUBLIC_REGISTRATION_EMAIL,
  });
  const vcfBase64 = Buffer.from(vcf).toString("base64");

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: formatResendSender(from),
    to: input.to,
    subject: "Subscription Confirmed - MediaPulse",
    html,
    text,
    attachments: [{ filename: "MediaPulse.vcf", content: vcfBase64 }],
  });
};

export type { SendEmail, SendPendingConfirmationEmailInput };
