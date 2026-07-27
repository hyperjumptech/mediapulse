import { createHash } from "node:crypto";

import {
  parseNewsletterEmailSubject,
  readNewsletterDocument,
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
  /** Subscription language; selects which rendered text the recipient receives. */
  language: "en" | "id";
};

/** A translated rendering of the newsletter for a non-English subscription language. */
export type DeliveryNewsletterTranslation = {
  language: "en" | "id";
  subject: string;
  content: string;
};

export type DeliveryNewsletter = {
  id: string;
  subject: string;
  content: string;
  symbol: string;
  /** Non-English translations; empty when none exist yet. */
  translations: DeliveryNewsletterTranslation[];
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

/** Unsubscribe link settings sourced from env at the call site. */
export type UnsubscribeSettings = {
  /**
   * Origin of the user-registration app (e.g. "https://register.mediapulse.com").
   * The confirmation page (`/unsubscribe`) and one-click endpoint (`/api/unsubscribe`)
   * are appended at runtime.
   */
  baseUrl: string;
  /** Shared HMAC secret for signing unsubscribe tokens. */
  secret: string;
};

/** DeliveryConfig augmented with the env-sourced unsubscribe settings a run needs. */
export type DeliveryRunConfig = DeliveryConfig & {
  unsubscribe: UnsubscribeSettings;
};

export type DeliverNewsletterDependencies = {
  resend: Resend;
  rateLimiter?: SendRateLimiter;
  logger?: LoggerLike;
  sendWithRetry?: typeof sendWithResendRetry;
  /**
   * Atomically claims a recipient before sending. Returns false when another concurrent
   * delivery run already owns this recipient, in which case the send is skipped. When
   * omitted, no claim is performed (e.g. test-email overrides that never checkpoint).
   */
  claimRecipient?: (userTickerId: string) => Promise<boolean>;
  /** Releases a claim after a failed send so the recipient can be retried by a later run. */
  releaseRecipient?: (userTickerId: string) => Promise<void>;
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
 * Extracts the domain from a sender string (`"Name <user@domain>"` or `"user@domain"`),
 * falling back to a fixed label when no domain is present.
 *
 * @param fromAddress - Resend `from` value.
 */
function senderDomain(fromAddress: string): string {
  const match = /@([^>\s]+)/.exec(fromAddress);

  return match?.[1] ?? "mediapulse";
}

/**
 * Builds a self-describing RFC `Message-ID` for a delivered newsletter so that a
 * reply's `In-Reply-To` header carries the newsletter and subscriber ids back to
 * the feedback agent. UUIDs contain no dots, so the ids parse unambiguously.
 *
 * @param newsletterId - Newsletter row id.
 * @param userTickerId - Subscriber join id.
 * @param fromAddress - Sender used for the domain part.
 */
export function buildNewsletterMessageId(
  newsletterId: string,
  userTickerId: string,
  fromAddress: string,
): string {
  return `<nl.${newsletterId}.${userTickerId}@${senderDomain(fromAddress)}>`;
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
  newsletter: DeliveryNewsletter,
  subscribers: DeliverySubscriber[],
  deliveredUserTickerIds: string[],
  config: DeliveryRunConfig,
  dependencies: DeliverNewsletterDependencies,
): Promise<{
  results: RecipientSendResult[];
  resendMessageIds: string[];
}> {
  const logger = dependencies.logger;
  const sendImpl = dependencies.sendWithRetry ?? sendWithResendRetry;
  const claimRecipient = dependencies.claimRecipient;
  const releaseRecipient = dependencies.releaseRecipient;
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

    // Resolve the rendered text for this subscriber's language. English uses the base
    // (canonical) newsletter; other languages use a translation. When a non-English
    // subscriber has no translation yet, skip them — never send English to an id subscriber.
    let localizedSubject = newsletter.subject;
    let localizedContent = newsletter.content;
    if (sub.language !== "en") {
      const translation = newsletter.translations.find(
        (t) => t.language === sub.language,
      );
      if (!translation) {
        results.push({
          userTickerId: sub.userTickerId,
          status: "skipped",
          attempts: 0,
          lastErrorMessage: "missing_translation",
          errorCategory: "skipped_missing_translation",
        });
        continue;
      }
      if (readNewsletterDocument(translation.content) === undefined) {
        logger?.warn?.(
          {
            newsletterId: newsletter.id,
            recipientRef: recipientLogRef(sub.userTickerId),
            language: sub.language,
          },
          "delivery translation is not a valid newsletter document — skipping recipient",
        );
        results.push({
          userTickerId: sub.userTickerId,
          status: "skipped",
          attempts: 0,
          lastErrorMessage: "invalid_translation",
          errorCategory: "skipped_invalid_translation",
        });
        continue;
      }
      localizedSubject = translation.subject;
      localizedContent = translation.content;
    }

    const ref = recipientLogRef(sub.userTickerId);

    // Claim the recipient before sending so two concurrent runs can never both send. The
    // claim inserts the delivery checkpoint up front; the loser of the race is told the
    // recipient is already owned and skips without sending.
    if (claimRecipient) {
      const claimed = await claimRecipient(sub.userTickerId);
      if (!claimed) {
        logger?.info?.(
          { recipientRef: ref, newsletterId: newsletter.id },
          "delivery recipient already claimed — skipping send",
        );
        results.push({
          userTickerId: sub.userTickerId,
          status: "skipped",
          attempts: 0,
          lastErrorMessage: "already_claimed",
          errorCategory: "skipped_already_claimed",
        });
        continue;
      }
    }

    const waitMs = await rateLimiter.acquire();
    if (waitMs > 0) {
      logger?.info?.(
        { recipientRef: ref, waitMs },
        "delivery rate limiter wait",
      );
    }

    // Generate per-subscriber unsubscribe token, confirmation page link, and one-click endpoint.
    const unsubscribeToken = createUnsubscribeToken({
      userTickerId: sub.userTickerId,
      tickerSymbol: newsletter.symbol,
      secret: config.unsubscribe.secret,
    });
    const unsubscribeBaseUrl = config.unsubscribe.baseUrl.replace(/\/$/, "");
    // Human-facing footer link points at the confirmation page.
    const unsubscribeUrl = `${unsubscribeBaseUrl}/unsubscribe?token=${unsubscribeToken}&lang=${sub.language}`;
    // RFC 8058 one-click POST endpoint for the List-Unsubscribe header (mail clients only).
    const oneClickUnsubscribeUrl = `${unsubscribeBaseUrl}/api/unsubscribe?token=${unsubscribeToken}`;

    const renderStart = Date.now();
    const emailTitle = parseNewsletterEmailSubject(localizedSubject).title;
    const { html, text } = await renderNewsletterEmail({
      title: emailTitle,
      bodyText: localizedContent,
      variant: config.template.newsletterVariant,
      unsubscribeUrl,
      tickerSymbol: newsletter.symbol,
      mediapulseSiteUrl: config.branding.mediapulseSiteUrl,
      hyperjumpSiteUrl: config.branding.hyperjumpSiteUrl,
      language: sub.language,
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
      subject: localizedSubject,
      ...(config.send.includeHtml ? { html } : {}),
      ...(config.send.includeText ? { text } : {}),
      ...(config.resend.replyTo !== undefined
        ? { replyTo: config.resend.replyTo }
        : {}),
      ...(config.resend.tags !== undefined && config.resend.tags.length > 0
        ? { tags: config.resend.tags }
        : {}),
      headers: {
        "List-Unsubscribe": `<${oneClickUnsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        // Self-describing Message-ID so a reply's In-Reply-To header lets the
        // newsletter-feedback agent correlate the reply to this newsletter and
        // subscriber without any extra storage or lookup.
        "Message-ID": buildNewsletterMessageId(
          newsletter.id,
          sub.userTickerId,
          from,
        ),
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
      // Release the claim so a later run can retry this recipient. Failing to release must
      // not turn a send failure into an unhandled error, so swallow and log release errors.
      if (releaseRecipient) {
        try {
          await releaseRecipient(sub.userTickerId);
        } catch (releaseErr) {
          logger?.error?.(
            { recipientRef: ref, err: releaseErr },
            "delivery claim release failed",
          );
        }
      }
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
