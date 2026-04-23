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
import type { UserRegistrationConfig } from "./config-schema.js";

import {
  extractSenderEmail,
  extractTickerSymbol,
  deriveNameFromEmailLocalPart,
} from "./lib/parser.js";

export type Input = { maxMessagesPerRun: number; watermark?: string };
export type Config = UserRegistrationConfig;

type RunDependencies = {
  createInbox?: typeof createOutlookInboxClient;
  ResendClient?: typeof Resend;
  createDataApi?: typeof createAgentDataApiClient;
};

type RateLimitConfig = {
  windowMs: number;
  maxAttempts: number;
};

const registrationAttempts = new Map<string, number[]>();
const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 60 * 1000,
  maxAttempts: 5,
};

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
};

/**
 * Predicate to determine if an error should be retried.
 * Evaluates HTTP status codes and Node.js network error codes to determine if
 * the error is likely a transient network or server issue.
 *
 * @param {any} error - The error object to evaluate.
 * @returns {boolean} True if the error is retryable.
 */
const isRetryable = (error: any): boolean => {
  // Network connection anomalies
  const networkErrors = [
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "ECONNREFUSED",
    "ECONNABORTED",
  ];
  if (error?.code && networkErrors.includes(error.code)) {
    return true;
  }

  // HTTP Status evaluations
  const status = error?.status || error?.response?.status;
  if (typeof status === "number") {
    // Retry on Server Errors (5xx), Too Many Requests (429), and Request Timeout (408)
    if (status >= 500 || status === 429 || status === 408) {
      return true;
    }
    // Fail fast on standard client errors (4xx) like bad requests, unauthorized, validation failure
    return false;
  }

  // If we can't determine the error type, default to not retrying
  // to avoid infinite loops on unexpected error objects.
  return false;
};

/**
 * Purges expired rate limit entries to prevent memory leaks over time.
 */
function sweepRateLimits(windowMs: number): void {
  const now = Date.now();
  for (const [email, attempts] of registrationAttempts.entries()) {
    const valid = attempts.filter((ts) => now - ts < windowMs);
    if (valid.length === 0) {
      registrationAttempts.delete(email);
    } else if (valid.length < attempts.length) {
      registrationAttempts.set(email, valid);
    }
  }
}

/**
 * Checks if a sender email has exceeded its rate limit.
 * Fail-fast: returns false if the limit is exceeded.
 *
 * @param {string} email - The email address to check.
 * @param {RateLimitConfig} rateLimitConfig - Configurable rate limiter settings.
 * @returns {boolean} True if within rate limits, false otherwise.
 */
function checkRateLimit(
  email: string,
  rateLimitConfig: RateLimitConfig,
): boolean {
  const now = Date.now();
  let attempts = registrationAttempts.get(email) ?? [];

  // Clean up old attempts
  attempts = attempts.filter((ts) => now - ts < rateLimitConfig.windowMs);

  if (attempts.length >= rateLimitConfig.maxAttempts) {
    registrationAttempts.set(email, attempts);
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
 *
 * @param {RunDependencies} deps - The injected dependencies.
 * @returns {Function} The agent run function.
 */
export const createRunHandler =
  ({
    createInbox = createOutlookInboxClient,
    ResendClient = Resend,
    createDataApi = createAgentDataApiClient,
  }: RunDependencies = {}) =>
  async ({
    input,
    token,
    config,
  }: AgentRunContext<Input, Config>): Promise<AgentRunResult> => {
    const rateLimitConfig: RateLimitConfig = {
      windowMs:
        config.rateLimit?.windowMs ?? DEFAULT_RATE_LIMIT_CONFIG.windowMs,
      maxAttempts:
        config.rateLimit?.maxAttempts ?? DEFAULT_RATE_LIMIT_CONFIG.maxAttempts,
    };

    const retryConfig: RetryConfig = {
      maxAttempts:
        config.retry?.maxAttempts ?? DEFAULT_RETRY_CONFIG.maxAttempts,
      baseDelayMs:
        config.retry?.baseDelayMs ?? DEFAULT_RETRY_CONFIG.baseDelayMs,
      maxDelayMs: config.retry?.maxDelayMs ?? DEFAULT_RETRY_CONFIG.maxDelayMs,
    };

    // Proactively clear stale items from the rate limiting map
    sweepRateLimits(rateLimitConfig.windowMs);

    logger.info(
      `Running user-registration agent. Max messages: ${input.maxMessagesPerRun}`,
    );

    const inboxClient = createInbox({
      clientId: config.outlookClientId,
      clientSecret: config.outlookClientSecret,
      tenantId: config.outlookTenantId,
      userId: config.outlookUserId,
    });

    const resend = new ResendClient(config.resendApiKey);

    const dataApiClient = createDataApi({
      baseUrl: env.AGENT_DATA_API_URL,
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
      retryConfig,
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
              rateLimitConfig,
              retryConfig,
            });

            if (result.status !== "failed_retry") {
              // Track the latest receivedDateTime for watermark management.
              if (msg.receivedDateTime) {
                const msgTime = new Date(msg.receivedDateTime).getTime();
                const latestTime = latestProcessedDate
                  ? new Date(latestProcessedDate).getTime()
                  : 0;

                if (!latestProcessedDate || msgTime > latestTime) {
                  latestProcessedDate = new Date(msgTime).toISOString();
                }
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
 * The default exported agent run handler.
 */
export const run = createRunHandler();

/**
 * Processes a single subscription message.
 * Handles parsing, rate limiting, registration, and email communication.
 *
 * @param {object} params - The processing parameters.
 * @param {GraphMessage} params.msg - The Graph API message object.
 * @param {any} params.inboxClient - The Outlook inbox client.
 * @param {Resend} params.resend - The Resend email client.
 * @param {AgentDataApiClient<"v1">} params.dataApiClient - The MediaPulse Data API client.
 * @param {Config} params.config - Agent configuration settings.
 * @returns {Promise<object>} The processing result for this message.
 */
async function processMessage({
  msg,
  inboxClient,
  resend,
  dataApiClient,
  config,
  rateLimitConfig,
  retryConfig,
}: {
  msg: GraphMessage;
  inboxClient: any;
  resend: Resend;
  dataApiClient: AgentDataApiClient<"v1">;
  config: Config;
  rateLimitConfig: RateLimitConfig;
  retryConfig: RetryConfig;
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
      retryConfig,
      isRetryable,
    );
    return { id: msg.id, status: "archived_unparseable" };
  }

  // Rate Limit check
  if (!checkRateLimit(senderEmail, rateLimitConfig)) {
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
      retryConfig,
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
        retryConfig,
        isRetryable,
      );

      await withRetry(
        () => inboxClient.archiveMessage(msg.id!),
        retryConfig,
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
        retryConfig,
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
        retryConfig,
        isRetryable,
      );

      await withRetry(
        () => inboxClient.archiveMessage(msg.id!),
        retryConfig,
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
        retryConfig,
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
