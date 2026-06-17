import { createHash } from "node:crypto";

import {
  parseNewsletterEmailSubject,
  renderNewsletterEmail,
} from "@workspace/email-templates";
import type { LoggerLike } from "@workspace/agent-runtime";
import { createUnsubscribeToken, formatResendSender } from "@workspace/utils";
import { Resend } from "resend";

import {
  classifyResendApiError,
  classifyResendError,
  extractResendResponseParts,
} from "./classify-resend-error.js";
import type { DeliveryConfig } from "./config-schema.js";
import { createSendRateLimiter, type SendRateLimiter } from "./rate-limiter.js";
import {
  sendWithResendRetry,
  type SendEmailPayload,
} from "./send-with-resend-retry.js";

export type DeliverySubscriber = {
  userTickerId: string;
  email: string;
};

export type RecipientSendResult = {
  userTickerId: string;
  status: "success" | "failed" | "skipped";
  attempts: number;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  errorCategory?: string;
  resendEmailId?: string;
};

export type DeliverNewsletterDependencies = {
  resend: Resend;
  rateLimiter?: SendRateLimiter;
  logger?: LoggerLike;
  sendWithRetry?: typeof sendWithResendRetry;
};

/**
 * Hashes a subscriber id for structured logs (no raw PII).
 *
 * @param userTickerId - Stable subscriber join id.
 */
export function recipientLogRef(userTickerId: string): string {
  return createHash("sha256").update(userTickerId).digest("hex").slice(0, 12);
}

/**
 * Maps Resend / transport failure to a stable analytics category for delivery runs.
 *
 * @param api - Parsed Resend API error when present.
 * @param kind - Retry bucket from string fallback classification.
 */
function recipientErrorCategory(
  api: { name: string } | undefined,
  kind: ReturnType<typeof classifyResendError>,
): string {
  if (kind === "rate_limited") {
    return "resend_rate_limited";
  }
  if (api !== undefined) {
    return `resend_${api.name}`;
  }
  if (kind === "transient") {
    return "resend_transient";
  }
  return "resend_error";
}

/**
 * Renders the newsletter and sends to each subscriber with rate limiting, retries, and skip semantics.
 *
 * @param newsletter - Subject, body text, and newsletter row id.
 * @param subscribers - Enabled subscribers with emails.
 * @param deliveredUserTickerIds - Already checkpointed ids (replay skip).
 * @param config - Validated delivery config (from + retry + template).
 * @param dependencies - Resend client, optional limiter/logger/send override.
 * @returns Per-recipient results and Resend message ids (for diagnostics).
 */
export async function deliverNewsletterToSubscribers(
  newsletter: { id: string; subject: string; content: string; symbol: string },
  subscribers: DeliverySubscriber[],
  deliveredUserTickerIds: string[],
  config: DeliveryConfig,
  dependencies: DeliverNewsletterDependencies,
): Promise<{
  results: RecipientSendResult[];
  resendMessageIds: string[];
}> {
  const logger = dependencies.logger;
  const sendImpl = dependencies.sendWithRetry ?? sendWithResendRetry;
  const rateLimiter =
    dependencies.rateLimiter ??
    createSendRateLimiter({
      minIntervalMs: config.rateLimit.minIntervalMs,
      maxSendsPerMinute: config.rateLimit.maxSendsPerMinute,
    });

  const deliveredSet = new Set(deliveredUserTickerIds);
  const from = formatResendSender(config.resend.from);

  const results: RecipientSendResult[] = [];
  const resendMessageIds: string[] = [];

  for (const sub of subscribers) {
    if (deliveredSet.has(sub.userTickerId)) {
      results.push({
        userTickerId: sub.userTickerId,
        status: "skipped",
        attempts: 0,
        lastErrorMessage: "already_delivered_checkpoint",
        errorCategory: "skipped_already_delivered",
      });
      continue;
    }

    const ref = recipientLogRef(sub.userTickerId);
    const waitMs = await rateLimiter.acquire();
    if (waitMs > 0) {
      logger?.info?.(
        { recipientRef: ref, waitMs },
        "delivery rate limiter wait",
      );
    }

    // Generate per-subscriber unsubscribe token and URL
    const unsubscribeToken = createUnsubscribeToken({
      userTickerId: sub.userTickerId,
      tickerSymbol: newsletter.symbol,
      secret: config.unsubscribe.secret,
    });
    const unsubscribeUrl = `${config.unsubscribe.baseUrl}/api/unsubscribe?token=${unsubscribeToken}`;

    const renderStart = Date.now();
    const emailTitle = parseNewsletterEmailSubject(newsletter.subject).title;
    const { html, text } = await renderNewsletterEmail({
      title: emailTitle,
      bodyText: newsletter.content,
      variant: config.template.newsletterVariant,
      unsubscribeUrl,
      tickerSymbol: newsletter.symbol,
      mediapulseSiteUrl: config.branding.mediapulseSiteUrl,
      hyperjumpSiteUrl: config.branding.hyperjumpSiteUrl,
    });
    logger?.info?.(
      {
        ms: Date.now() - renderStart,
        newsletterId: newsletter.id,
        recipientRef: ref,
      },
      "delivery newsletter render timing",
    );

    const payload: SendEmailPayload = {
      from,
      to: sub.email,
      subject: newsletter.subject,
      ...(config.send.includeHtml ? { html } : {}),
      ...(config.send.includeText ? { text } : {}),
      ...(config.resend.replyTo !== undefined
        ? { replyTo: config.resend.replyTo }
        : {}),
      ...(config.resend.tags !== undefined && config.resend.tags.length > 0
        ? { tags: config.resend.tags }
        : {}),
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };

    try {
      const { id, attempts } = await sendImpl(
        dependencies.resend,
        payload,
        config.retry,
      );
      if (id) {
        resendMessageIds.push(id);
      }
      results.push({
        userTickerId: sub.userTickerId,
        status: "success",
        attempts,
        resendEmailId: id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const attempts =
        typeof err === "object" &&
        err !== null &&
        "attempts" in err &&
        typeof (err as { attempts: unknown }).attempts === "number"
          ? (err as { attempts: number }).attempts
          : config.retry.maxAttempts;
      const { api } = extractResendResponseParts(err);
      const kind =
        api !== undefined
          ? classifyResendApiError(api)
          : classifyResendError(err);
      const category = recipientErrorCategory(api, kind);
      logger?.error?.(
        {
          recipientRef: ref,
          err,
          errorCategory: category,
          resendErrorName: api?.name,
        },
        "delivery send failed",
      );
      results.push({
        userTickerId: sub.userTickerId,
        status: "failed",
        attempts,
        lastErrorCode: api?.name ?? "resend_error",
        lastErrorMessage: message.slice(0, 500),
        errorCategory: category,
      });
    }
  }

  const successCount = results.filter((r) => r.status === "success").length;
  const failedCount = results.filter((r) => r.status === "failed").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;
  logger?.info?.(
    {
      newsletterId: newsletter.id,
      successCount,
      failedCount,
      skippedCount,
      totalRecipients: results.length,
    },
    "delivery recipient batch summary",
  );

  return { results, resendMessageIds };
}
