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
import {
  withRetry,
  type RetryConfig,
  MEDIAPULSE_SENDER_NAME,
  formatResendSender,
  buildVCard,
} from "@workspace/utils";
import { Resend } from "resend";
import { logger } from "@workspace/logger";
import type { UserRegistrationConfig } from "./config-schema.js";

import {
  extractSenderEmail,
  extractTickerSymbol,
  resolveSubscriberDisplayName,
} from "./lib/parser.js";

import { computeSafeWatermark } from "./lib/watermark.js";

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

/**
 * Clears in-memory per-sender rate-limit counters (for unit tests only).
 */
export const resetRegistrationRateLimitsForTest = (): void => {
  registrationAttempts.clear();
};
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

/** Minimal shape of `resend.emails.send` resolution (SDK returns `{ data, error }` without rejecting). */
type ResendEmailsSendResult = {
  error?: { message: string } | null;
  data?: unknown;
};

/**
 * Throws when Resend returns an error in the result envelope so a failed send is not treated as success.
 * Without this, the agent can call `user-registration-confirm` even though no email was accepted.
 *
 * @param result - Resolved value from {@link Resend.prototype.emails.send}.
 * @throws Error when `result.error` is set.
 */
function assertResendSendSucceeded(result: ResendEmailsSendResult): void {
  if (result.error) {
    throw new Error(`Resend email send failed: ${result.error.message}`);
  }
}

function buildNextDeliveryLabel(
  hour: number,
  timezone: string,
  timeLabel: string,
): string {
  const currentHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    }).format(new Date()),
    10,
  );
  const day = currentHour < hour ? "today" : "tomorrow";

  return `${day} at ${timeLabel}`;
}

type ResendTransactionalPayload = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: string }[];
};

/**
 * Sends one transactional email via Resend with retries, validates the SDK `{ data, error }` envelope,
 * and logs before/after so operators can tell whether a run actually invoked Resend (the dashboard only
 * shows traffic that reached Resend with your API key).
 *
 * @param params.resend - Resend client instance.
 * @param params.payload - From, to, subject, html, and text.
 * @param params.retryConfig - Backoff configuration for transient failures.
 * @param params.logBase - Structured fields included on every log line (e.g. `messageId`, `senderEmail` = subscriber). Logs also emit `resendFrom` and `resendRecipientEmail` (Resend From / To).
 * @returns Resend email id from `data.id` when the API returns it.
 */
async function sendResendTransactionalEmail(params: {
  resend: Resend;
  payload: ResendTransactionalPayload;
  retryConfig: RetryConfig;
  logBase: Record<string, unknown>;
}): Promise<string | undefined> {
  const { resend, payload, retryConfig, logBase } = params;

  // `payload.from` = Hermes resendSender. `payload.to` = subscriber (Outlook From), i.e. confirmation recipient.
  logger.info(
    {
      ...logBase,
      resendFrom: payload.from,
      resendRecipientEmail: payload.to,
      resendSubject: payload.subject,
    },
    "user-registration: calling Resend emails.send",
  );

  const result = await withRetry(
    async () => {
      const sendResult = await resend.emails.send(payload);
      assertResendSendSucceeded(sendResult);
      return sendResult;
    },
    retryConfig,
    isRetryable,
  );

  const data = result.data;
  const resendEmailId =
    data !== null &&
    data !== undefined &&
    typeof data === "object" &&
    "id" in data &&
    typeof (data as { id: unknown }).id === "string"
      ? (data as { id: string }).id
      : undefined;

  logger.info(
    {
      ...logBase,
      resendEmailId,
      resendSubject: payload.subject,
    },
    "user-registration: Resend emails.send accepted",
  );

  return resendEmailId;
}

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
    hermesCorrelation,
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

    const report = (
      title: string,
      description?: string,
      status: "processing" | "completed" = "processing",
    ) => {
      const jobId = hermesCorrelation?.jobId;
      if (jobId && token) {
        void fetch(`${env.AGENT_REGISTRY_URL}/api/agent-activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: token },
          body: JSON.stringify({ jobId, title, description, status }),
        }).catch(() => {});
      }
    };

    const inboxPageSize = config.inboxPageSize ?? 50;
    const inboxMaxPagesPerRun = config.inboxMaxPagesPerRun ?? 20;

    report(
      "Reading subscription inbox",
      `up to ${input.maxMessagesPerRun} messages`,
    );

    // Step 0: List messages — paginate oldest-first, capped at maxMessagesPerRun matches.
    // receivedAfter is an inclusive `ge` filter. The boundary message was already archived
    // last run, so it is no longer unread and won't be re-listed. Same-timestamp siblings
    // are safe because userRegistrationRegister.create is idempotent (returns
    // isNewSubscription: false, triggering only an acknowledge-and-archive path).
    const { messages, pagesScanned, messagesScanned, drained } =
      await withRetry(
        () =>
          inboxClient.listMessages(
            {
              subjectContains: "[MediaPulse] Newsletter Subscription",
              isUnread: true,
              ...(input.watermark
                ? { receivedAfter: new Date(input.watermark) }
                : {}),
            },
            {
              limit: input.maxMessagesPerRun,
              pageSize: inboxPageSize,
              orderBy: "receivedDateTime asc",
              maxPages: inboxMaxPagesPerRun,
            },
          ),
        retryConfig,
        isRetryable,
      );

    logger.info(
      `Found ${messages.length} subscription messages (scanned ${messagesScanned} across ${pagesScanned} pages, drained: ${drained}).`,
    );

    report("Scanning subscription requests", `${messages.length} emails found`);

    if (messages.length === 0) {
      report(
        "Registration run complete",
        "0 registered, 0 skipped",
        "completed",
      );
      return {
        success: true,
        details: {
          processed: 0,
          results: [],
          inboxScan: {
            pagesScanned,
            messagesScanned,
            matchedMessages: 0,
            limit: input.maxMessagesPerRun,
            drained,
          },
        },
      };
    }

    report("Processing registrations", `${messages.length} eligible requests`);

    // Process messages in parallel with a concurrency limit of 5.
    const CONCURRENCY = 5;
    const results: any[] = [];

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
            return { ...result, receivedDateTime: msg.receivedDateTime };
          } catch (error) {
            logger.error(
              { error, messageId: msg.id },
              "Unexpected error processing message.",
            );
            return {
              id: msg.id,
              status: "failed_retry",
              receivedDateTime: msg.receivedDateTime,
            };
          }
        }),
      );
      results.push(...batchResults);
    }

    const newWatermark = computeSafeWatermark(results, input.watermark);

    const registeredCount = results.filter(
      (result) =>
        result.status === "confirmed_archived" ||
        result.status === "acknowledged_archived",
    ).length;
    const skippedCount = results.length - registeredCount;

    report(
      "Registration run complete",
      `${registeredCount} registered, ${skippedCount} skipped (drained: ${drained})`,
      "completed",
    );

    return {
      success: true,
      details: {
        processed: results.length,
        results,
        newWatermark,
        inboxScan: {
          pagesScanned,
          messagesScanned,
          matchedMessages: messages.length,
          limit: input.maxMessagesPerRun,
          drained,
        },
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

  const name = resolveSubscriberDisplayName(msg, senderEmail);

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

      await sendResendTransactionalEmail({
        resend,
        retryConfig,
        logBase: {
          messageId: msg.id,
          senderEmail,
          tickerSymbol,
          template: "invalid-ticker",
        },
        payload: {
          from: formatResendSender(config.resendSender),
          to: senderEmail,
          subject: "Invalid Ticker Selection - MediaPulse",
          html,
          text,
        },
      });

      await withRetry(
        () => inboxClient.archiveMessage(msg.id!),
        retryConfig,
        isRetryable,
      );
      return { id: msg.id, status: "invalid_ticker_archived" };
    }

    const isNewSubscription = registerResponse.isNewSubscription;

    if (isNewSubscription) {
      logger.info(
        { senderEmail, tickerSymbol },
        "Sending confirmation email for new or unconfirmed subscription.",
      );

      const nextDeliveryLabel =
        config.newsletterDeliveryHour !== undefined &&
        config.newsletterDeliveryTimezone !== undefined &&
        config.newsletterDeliveryTimeLabel !== undefined
          ? buildNextDeliveryLabel(
              config.newsletterDeliveryHour,
              config.newsletterDeliveryTimezone,
              config.newsletterDeliveryTimeLabel,
            )
          : undefined;

      const { html, text } = await renderNewsletterEmail({
        variant: "registration-confirmation",
        tickerSymbol,
        nextDeliveryLabel,
      });

      const vcf = buildVCard({
        name: MEDIAPULSE_SENDER_NAME,
        email: config.resendSender,
      });
      const vcfBase64 = Buffer.from(vcf).toString("base64");

      await sendResendTransactionalEmail({
        resend,
        retryConfig,
        logBase: {
          messageId: msg.id,
          senderEmail,
          tickerSymbol,
          isNewSubscription: true,
          template: "registration-confirmation",
        },
        payload: {
          from: formatResendSender(config.resendSender),
          to: senderEmail,
          subject: "Subscription Confirmed - MediaPulse",
          html,
          text,
          attachments: [{ filename: "MediaPulse.vcf", content: vcfBase64 }],
        },
      });

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
    } else {
      logger.info(
        { senderEmail, tickerSymbol },
        "Subscription already confirmed; skipping outbound email.",
      );
    }

    await withRetry(
      () => inboxClient.archiveMessage(msg.id!),
      retryConfig,
      isRetryable,
    );
    return {
      id: msg.id,
      status: isNewSubscription
        ? "confirmed_archived"
        : "acknowledged_archived",
    };
  } catch (error) {
    logger.error(
      {
        messageId: msg.id,
        senderEmail,
        tickerSymbol,
        err:
          error instanceof Error
            ? { message: error.message, name: error.name, stack: error.stack }
            : error,
      },
      "Failed processing message during agent run. Leaving unarchived for retry.",
    );
    return { id: msg.id, status: "failed_retry" };
  }
}
