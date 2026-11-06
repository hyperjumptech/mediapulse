import { Resend } from "resend";
import { renderNewsletterEmail } from "@workspace/email-templates";
import { logger, type Logger } from "@workspace/logger";
import {
  assertResendSendSucceeded,
  buildVCard,
  createRegistrationConfirmToken,
  formatResendSender,
  MEDIAPULSE_SENDER_NAME,
  readResendEmailId,
  type ResendEmailsSendResult,
} from "@workspace/utils";
import { env } from "@mediapulse/env/app-user-registration";

type SendPendingConfirmationEmailInput = {
  to: string;
  name: string;
  tickerSymbol: string;
  userTickerId: string;
};

type SendRegistrationConfirmedEmailInput = {
  to: string;
  tickerSymbol: string;
};

type ResendEmailPayload = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: string }[];
};

type ResendEmailsClient = {
  emails: {
    send: (payload: ResendEmailPayload) => Promise<ResendEmailsSendResult>;
  };
};

type CreateResendClient = (apiKey: string) => ResendEmailsClient;

type RegistrationEmailLogger = Pick<Logger, "info">;

type SendRegistrationEmailDeps = {
  createResendClient?: CreateResendClient;
  renderEmail?: typeof renderNewsletterEmail;
  log?: RegistrationEmailLogger;
};

type SendEmail = (input: SendPendingConfirmationEmailInput) => Promise<void>;

const createResendClientDefault: CreateResendClient = (apiKey) =>
  new Resend(apiKey);

const readResendSettings = (): { apiKey: string; from: string } => {
  const apiKey = env.USER_REGISTRATION_RESEND_API_KEY.trim();
  const from = env.USER_REGISTRATION_RESEND_FROM.trim();
  if (!apiKey || !from) {
    throw new Error(
      "USER_REGISTRATION_RESEND_API_KEY and USER_REGISTRATION_RESEND_FROM must both be set to send registration email",
    );
  }

  return { apiKey, from: formatResendSender(from) };
};

const sendTransactionalEmail = async ({
  payload,
  apiKey,
  template,
  logFields,
  deps,
}: {
  payload: ResendEmailPayload;
  apiKey: string;
  template: string;
  logFields: Record<string, unknown>;
  deps: SendRegistrationEmailDeps;
}): Promise<void> => {
  const createResendClient =
    deps.createResendClient ?? createResendClientDefault;
  const log = deps.log ?? logger;

  log.info(
    {
      ...logFields,
      template,
      resendFrom: payload.from,
      resendSubject: payload.subject,
    },
    "user-registration: calling Resend emails.send",
  );

  const resend = createResendClient(apiKey);
  const result = await resend.emails.send(payload);
  assertResendSendSucceeded(result);
  const resendEmailId = readResendEmailId(result);

  log.info(
    { ...logFields, template, resendEmailId },
    "user-registration: Resend emails.send accepted",
  );
};

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
export const sendPendingConfirmationEmailDefault = async (
  input: SendPendingConfirmationEmailInput,
  deps: SendRegistrationEmailDeps = {},
): Promise<void> => {
  const renderEmail = deps.renderEmail ?? renderNewsletterEmail;
  const { apiKey, from } = readResendSettings();
  const token = createRegistrationConfirmToken({
    userTickerId: input.userTickerId,
    tickerSymbol: input.tickerSymbol,
    secret: env.REGISTRATION_CONFIRM_SECRET,
  });
  const confirmUrl = buildRegistrationConfirmUrl(token);
  const { html, text } = await renderEmail({
    variant: "registration-pending-confirmation",
    tickerSymbol: input.tickerSymbol,
    name: input.name,
    confirmUrl,
  });

  await sendTransactionalEmail({
    payload: {
      from,
      to: input.to,
      subject: "Confirm your MediaPulse subscription",
      html,
      text,
    },
    apiKey,
    template: "registration-pending-confirmation",
    logFields: {
      userTickerId: input.userTickerId,
      tickerSymbol: input.tickerSymbol,
    },
    deps,
  });
};

/**
 * Sends the post-confirmation welcome email with vCard attachment.
 *
 * @param input - Recipient and ticker details.
 */
export const sendRegistrationConfirmedEmailDefault = async (
  input: SendRegistrationConfirmedEmailInput,
  deps: SendRegistrationEmailDeps = {},
): Promise<void> => {
  const renderEmail = deps.renderEmail ?? renderNewsletterEmail;
  const { apiKey, from } = readResendSettings();
  const { html, text } = await renderEmail({
    variant: "registration-confirmation",
    tickerSymbol: input.tickerSymbol,
  });
  const vcf = buildVCard({
    name: MEDIAPULSE_SENDER_NAME,
    email: env.NEXT_PUBLIC_REGISTRATION_EMAIL,
  });
  const vcfBase64 = Buffer.from(vcf).toString("base64");

  await sendTransactionalEmail({
    payload: {
      from,
      to: input.to,
      subject: "Subscription Confirmed - MediaPulse",
      html,
      text,
      attachments: [{ filename: "MediaPulse.vcf", content: vcfBase64 }],
    },
    apiKey,
    template: "registration-confirmation",
    logFields: { tickerSymbol: input.tickerSymbol },
    deps,
  });
};

export type {
  CreateResendClient,
  ResendEmailPayload,
  SendEmail,
  SendPendingConfirmationEmailInput,
  SendRegistrationEmailDeps,
};
