import { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-user-registration";
import {
  createOutlookInboxClient,
  type GraphMessage,
} from "@mediapulse/outlook-inbox";
import {
  createAgentDataApiClient,
  type AgentDataApiClient,
} from "@workspace/agent-data-api-client";
import { renderNewsletterEmail } from "@workspace/email-templates";
import { withRetry, type RetryConfig } from "@workspace/utils";
import { Resend } from "resend";
import { logger } from "@workspace/logger";

import {
  extractSenderEmail,
  extractTickerSymbol,
  deriveNameFromEmailLocalPart,
} from "./lib/parser.js";

export type Input = { maxMessagesPerRun: number; watermark?: string };
export type Config = {
  outlookClientId: string;
  outlookClientSecret: string;
  outlookTenantId: string;
  outlookUserId: string;
  resendApiKey: string;
  resendSender: string;
};

// Per-email rate limiter: max 5 attempts per 1 hour per email address.
const registrationAttempts = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS_IN_WINDOW = 5;

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
};

/**
 * Predicate to determine if an error should be retried.
 * Retries all errors for now, assuming they are transient network/API issues.
 */
const isRetryable = () => true;

/**
 * Checks if a sender email has exceeded its rate limit.
 * Fail-fast: returns false if the limit is exceeded.
 */
function checkRateLimit(email: string): boolean {
  const now = Date.now();
  let attempts = registrationAttempts.get(email) ?? [];

  // Clean up old attempts
  attempts = attempts.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

  if (attempts.length >= MAX_ATTEMPTS_IN_WINDOW) {
    return false;
  }

  attempts.push(now);
  registrationAttempts.set(email, attempts);
  return true;
}

/**
 * Core business logic for the user-registration agent.
 * Processes unread newsletter subscription emails from Outlook,
 * registers users in the MediaPulse system, and sends confirmation emails.
 */
export const run = async ({
  input,
  token,
  config,
}: AgentRunContext<Input, Config>): Promise<AgentRunResult> => {
  logger.info(
    `Running user-registration agent. Max messages: ${input.maxMessagesPerRun}`,
  );

  const inboxClient = createOutlookInboxClient({
    clientId: config.outlookClientId,
    clientSecret: config.outlookClientSecret,
    tenantId: config.outlookTenantId,
    userId: config.outlookUserId,
  });

  const resend = new Resend(config.resendApiKey);

  const dataApiClient = createAgentDataApiClient({
    baseUrl: env.AGENT_DATA_API_URL!,
    version: "v1",
    token,
  });

  // Step 0: List messages
  const messages = await withRetry(
    () =>
      inboxClient.listMessages(
        {
          subjectContains: "[MediaPulse] Newsletter Subscription",
          isUnread: true,
          ...(input.watermark
            ? { receivedAfter: new Date(input.watermark) }
            : {}),
        },
        { top: input.maxMessagesPerRun },
      ),
    DEFAULT_RETRY_CONFIG,
    isRetryable,
  );

  logger.info(`Found ${messages.length} messages to process.`);

  if (messages.length === 0) {
    return { success: true, details: { processed: 0, results: [] } };
  }

  // Process messages in parallel with a concurrency limit of 5.
  const CONCURRENCY = 5;
  const results: any[] = [];
  let latestProcessedDate: string | undefined = input.watermark;

  for (let i = 0; i < messages.length; i += CONCURRENCY) {
    const batch = messages.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (msg) => {
        try {
          const result = await processMessage({
            msg,
            inboxClient,
            resend,
            dataApiClient,
            config,
          });

          if (result.status !== "failed_retry") {
            // Track the latest receivedDateTime for watermark management.
            if (
              !latestProcessedDate ||
              (msg.receivedDateTime &&
                msg.receivedDateTime > latestProcessedDate)
            ) {
              latestProcessedDate = msg.receivedDateTime ?? latestProcessedDate;
            }
          }

          return result;
        } catch (error) {
          logger.error(
            { error, messageId: msg.id },
            "Unexpected error processing message.",
          );
          return { id: msg.id, status: "failed_retry" };
        }
      }),
    );
    results.push(...batchResults);
  }

  return {
    success: true,
    details: {
      processed: results.length,
      results,
      newWatermark: latestProcessedDate,
    },
  };
};

/**
 * Processes a single subscription message.
 * Handles parsing, rate limiting, registration, and email communication.
 */
async function processMessage({
  msg,
  inboxClient,
  resend,
  dataApiClient,
  config,
}: {
  msg: GraphMessage;
  inboxClient: any;
  resend: Resend;
  dataApiClient: AgentDataApiClient<"v1">;
  config: Config;
}) {
  const senderEmail = extractSenderEmail(msg);
  const tickerSymbol = extractTickerSymbol(msg.subject, msg.body?.content);

  if (!senderEmail || !tickerSymbol) {
    logger.warn(
      {
        parseFailureReason: "Missing sender or ticker",
        messageId: msg.id,
      },
      "Archiving unparseable message.",
    );
    await withRetry(
      () => inboxClient.archiveMessage(msg.id!),
      DEFAULT_RETRY_CONFIG,
      isRetryable,
    );
    return { id: msg.id, status: "archived_unparseable" };
  }

  // Rate Limit check
  if (!checkRateLimit(senderEmail)) {
    logger.warn(
      { senderEmail, messageId: msg.id },
      "Rate limit exceeded for sender. Leaving unarchived for retry.",
    );
    return { id: msg.id, status: "failed_retry" };
  }

  const name = deriveNameFromEmailLocalPart(senderEmail);

  try {
    // Step 2: Register via API
    const registerResponse = await withRetry(
      () =>
        dataApiClient.userRegistrationRegister.create({
          email: senderEmail,
          tickerSymbol,
          name,
          audit: {
            graphMessageId: msg.id,
            receivedAt: msg.receivedDateTime,
          },
        }),
      DEFAULT_RETRY_CONFIG,
      isRetryable,
    );

    if (!registerResponse.tickerKnown) {
      logger.info(
        { tickerSymbol, senderEmail },
        "Ticker unknown, sending invalid-ticker email.",
      );

      const { html, text } = await renderNewsletterEmail({
        variant: "invalid-ticker",
        tickerSymbol,
      });

      await withRetry(
        () =>
          resend.emails.send({
            from: config.resendSender,
            to: senderEmail,
            subject: "Invalid Ticker Selection - MediaPulse",
            html,
            text,
          }),
        DEFAULT_RETRY_CONFIG,
        isRetryable,
      );

      await withRetry(
        () => inboxClient.archiveMessage(msg.id!),
        DEFAULT_RETRY_CONFIG,
        isRetryable,
      );
      return { id: msg.id, status: "invalid_ticker_archived" };
    }

    if (registerResponse.isNewSubscription) {
      logger.info({ senderEmail, tickerSymbol }, "Sending confirmation email.");

      const { html, text } = await renderNewsletterEmail({
        variant: "registration-confirmation",
        tickerSymbol,
      });

      await withRetry(
        () =>
          resend.emails.send({
            from: config.resendSender,
            to: senderEmail,
            subject: "Subscription Confirmed - MediaPulse",
            html,
            text,
          }),
        DEFAULT_RETRY_CONFIG,
        isRetryable,
      );

      await withRetry(
        () =>
          dataApiClient.userRegistrationConfirm.create({
            userTickerId: registerResponse.userTickerId!,
            audit: {
              graphMessageId: msg.id,
            },
          }),
        DEFAULT_RETRY_CONFIG,
        isRetryable,
      );

      await withRetry(
        () => inboxClient.archiveMessage(msg.id!),
        DEFAULT_RETRY_CONFIG,
        isRetryable,
      );
      return { id: msg.id, status: "confirmed_archived" };
    } else {
      logger.info(
        { senderEmail, tickerSymbol },
        "Subscription already active, archiving with no email.",
      );
      await withRetry(
        () => inboxClient.archiveMessage(msg.id!),
        DEFAULT_RETRY_CONFIG,
        isRetryable,
      );
      return { id: msg.id, status: "idempotent_archived" };
    }
  } catch (error) {
    logger.error(
      { error, messageId: msg.id },
      "Failed processing message during agent run. Leaving unarchived for retry.",
    );
    return { id: msg.id, status: "failed_retry" };
  }
}
