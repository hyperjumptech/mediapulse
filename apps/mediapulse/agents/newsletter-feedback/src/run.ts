import { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-newsletter-feedback";
import {
  createOutlookInboxClient,
  type GraphMessage,
} from "@mediapulse/outlook-inbox";
import {
  createAgentDataApiClient,
  type AgentDataApiClient,
} from "@workspace/agent-data-api-client";
import { withRetry, type RetryConfig } from "@workspace/utils";
import { logger } from "@workspace/logger";

import type { NewsletterFeedbackConfig } from "./config-schema.js";
import { classifyFeedback } from "./lib/classify.js";
import type { GenerateObjectForClassification } from "./lib/classify.js";
import {
  extractInReplyToMessageId,
  extractSenderEmail,
  isNewsletterReply,
  stripQuotedReply,
} from "./lib/parser.js";
import { computeSafeWatermark } from "./lib/watermark.js";

export type Input = { maxMessagesPerRun: number; watermark?: string };
export type Config = NewsletterFeedbackConfig;

type RunDependencies = {
  createInbox?: typeof createOutlookInboxClient;
  createDataApi?: typeof createAgentDataApiClient;
  classify?: GenerateObjectForClassification;
};

/** Graph fields requested via `$select`; includes headers for reply correlation. */
const GRAPH_SELECT_FIELDS = [
  "id",
  "subject",
  "receivedDateTime",
  "isRead",
  "from",
  "body",
  "internetMessageHeaders",
];

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
};

const DEFAULT_INBOX_PAGE_SIZE = 50;
const DEFAULT_INBOX_MAX_PAGES_PER_RUN = 20;
const DEFAULT_MAIL_FOLDER = "inbox";
const DEFAULT_MAX_MESSAGE_ATTEMPTS = 5;
const CONCURRENCY = 5;

/**
 * Per-message consecutive failure counts, keyed by Graph message id, used to
 * dead-letter a poison message after repeated failures so it cannot block the
 * oldest slot forever under oldest-first ordering.
 */
const messageProcessingAttempts = new Map<string, number>();

/** Clears in-memory per-message attempt counters (for unit tests only). */
export const resetMessageAttemptsForTest = (): void => {
  messageProcessingAttempts.clear();
};

/**
 * Predicate to determine if an error should be retried (transient network or
 * server issue).
 *
 * @param error - The error object to evaluate.
 */
const isRetryable = (error: any): boolean => {
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

  const status = error?.status || error?.response?.status;
  if (typeof status === "number") {
    if (status >= 500 || status === 429 || status === 408) {
      return true;
    }

    return false;
  }

  return false;
};

/**
 * Core business logic for the newsletter-feedback agent. Reads unread mail from
 * the shared inbox, processes only genuine newsletter replies (identified by a
 * self-describing `In-Reply-To`), classifies them with the LLM, persists via
 * agent-data-api, archives them, and advances a safe watermark.
 *
 * @param deps - Injected collaborators for testing.
 */
export const createRunHandler =
  ({
    createInbox = createOutlookInboxClient,
    createDataApi = createAgentDataApiClient,
    classify = classifyFeedback,
  }: RunDependencies = {}) =>
  async ({
    input,
    token,
    config,
    hermesCorrelation,
  }: AgentRunContext<Input, Config>): Promise<AgentRunResult> => {
    const retryConfig = DEFAULT_RETRY_CONFIG;

    logger.info(
      `Running newsletter-feedback agent. Max messages: ${input.maxMessagesPerRun}`,
    );

    const inboxClient = createInbox({
      clientId: config.outlook.clientId,
      clientSecret: config.outlook.clientSecret,
      tenantId: config.outlook.tenantId,
      userId: config.outlook.userId,
      mailFolder: DEFAULT_MAIL_FOLDER,
    });

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

    report(
      "Reading newsletter replies",
      `up to ${input.maxMessagesPerRun} messages`,
    );

    // Paginate oldest-first. No subject filter: replies carry arbitrary "Re:"
    // subjects, so we identify them by the self-describing In-Reply-To header.
    const { messages, pagesScanned, messagesScanned, drained } =
      await withRetry(
        () =>
          inboxClient.listMessages(
            {
              isUnread: true,
              ...(input.watermark
                ? { receivedAfter: new Date(input.watermark) }
                : {}),
            },
            {
              limit: input.maxMessagesPerRun,
              pageSize: DEFAULT_INBOX_PAGE_SIZE,
              orderBy: "receivedDateTime asc",
              maxPages: DEFAULT_INBOX_MAX_PAGES_PER_RUN,
              select: GRAPH_SELECT_FIELDS,
            },
          ),
        retryConfig,
        isRetryable,
      );

    logger.info(
      `Scanned ${messagesScanned} messages across ${pagesScanned} pages (drained: ${drained}).`,
    );

    if (messages.length === 0) {
      report("Feedback run complete", "0 replies processed", "completed");

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
            mailFolder: DEFAULT_MAIL_FOLDER,
          },
        },
      };
    }

    report("Processing newsletter replies", `${messages.length} messages`);

    const results: any[] = [];
    for (let i = 0; i < messages.length; i += CONCURRENCY) {
      const batch = messages.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (msg) => {
          try {
            const result = await processMessage({
              msg,
              inboxClient,
              dataApiClient,
              config,
              classify,
              retryConfig,
              maxMessageAttempts: DEFAULT_MAX_MESSAGE_ATTEMPTS,
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

    const classifiedCount = results.filter(
      (result) => result.status === "classified_archived",
    ).length;
    const skippedCount = results.length - classifiedCount;

    report(
      "Feedback run complete",
      `${classifiedCount} classified, ${skippedCount} skipped (drained: ${drained})`,
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
          mailFolder: DEFAULT_MAIL_FOLDER,
        },
      },
    };
  };

/** The default exported agent run handler. */
export const run = createRunHandler();

/**
 * Processes a single inbox message: skips non-replies, classifies genuine
 * newsletter replies, persists them, and archives.
 */
async function processMessage({
  msg,
  inboxClient,
  dataApiClient,
  config,
  classify,
  retryConfig,
  maxMessageAttempts,
}: {
  msg: GraphMessage;
  inboxClient: ReturnType<typeof createOutlookInboxClient>;
  dataApiClient: AgentDataApiClient<"v1">;
  config: Config;
  classify: GenerateObjectForClassification;
  retryConfig: RetryConfig;
  maxMessageAttempts: number;
}) {
  const inReplyToMessageId = extractInReplyToMessageId(msg);

  // Not one of our newsletters: leave it for the registration agent / humans.
  // Do not archive; the watermark prevents re-scanning.
  if (!isNewsletterReply(inReplyToMessageId)) {
    return { id: msg.id, status: "skipped_not_feedback" };
  }

  const senderEmail = extractSenderEmail(msg);
  if (!senderEmail) {
    logger.warn(
      { messageId: msg.id },
      "Newsletter reply without a usable sender; archiving as unparseable.",
    );
    await withRetry(
      () => inboxClient.archiveMessage(msg.id),
      retryConfig,
      isRetryable,
    );
    if (msg.id) messageProcessingAttempts.delete(msg.id);

    return { id: msg.id, status: "archived_unparseable" };
  }

  try {
    const rawBody = msg.body?.content ?? "";
    const replyText = stripQuotedReply(rawBody) || rawBody;

    const classification = await classify({
      apiKey: config.model.apiKey,
      model: config.model.model,
      baseUrl: config.model.baseUrl,
      replyText,
    });

    const recordResponse = await withRetry(
      () =>
        dataApiClient.newsletterFeedbackRecord.create({
          graphMessageId: msg.id,
          senderEmail,
          subject: msg.subject,
          rawBody,
          receivedAt: msg.receivedDateTime,
          inReplyToMessageId,
          sentiment: classification.sentiment,
          category: classification.category,
          classifierModel: config.model.model,
        }),
      retryConfig,
      isRetryable,
    );

    await withRetry(
      () => inboxClient.archiveMessage(msg.id),
      retryConfig,
      isRetryable,
    );
    if (msg.id) messageProcessingAttempts.delete(msg.id);

    return {
      id: msg.id,
      status: "classified_archived",
      sentiment: classification.sentiment,
      category: classification.category,
      correlated: recordResponse.correlated,
    };
  } catch (error) {
    const errorDetails =
      error instanceof Error
        ? { message: error.message, name: error.name }
        : error;

    // Head-of-line guard: dead-letter a message that fails every run so the
    // oldest slot can advance. Counters reset on terminal success above.
    const attempts = msg.id
      ? (messageProcessingAttempts.get(msg.id) ?? 0) + 1
      : 1;

    if (msg.id && attempts >= maxMessageAttempts) {
      try {
        await withRetry(
          () => inboxClient.archiveMessage(msg.id),
          retryConfig,
          isRetryable,
        );
        messageProcessingAttempts.delete(msg.id);
        logger.warn(
          { messageId: msg.id, senderEmail, attempts },
          "Dead-lettering newsletter reply after repeated failures.",
        );

        return { id: msg.id, status: "dead_lettered" };
      } catch (deadLetterError) {
        logger.error(
          { messageId: msg.id, err: deadLetterError },
          "Failed to dead-letter message after repeated failures.",
        );
      }
    }

    if (msg.id) messageProcessingAttempts.set(msg.id, attempts);

    logger.error(
      { messageId: msg.id, senderEmail, attempts, err: errorDetails },
      "Failed processing newsletter reply. Leaving unarchived for retry.",
    );

    return { id: msg.id, status: "failed_retry" };
  }
}
