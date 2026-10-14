import { createHash } from "node:crypto";

import {
  parseNewsletterEmailSubject,
  readNewsletterDocument,
  renderNewsletterEmail,
} from "@workspace/email-templates";
import type { LoggerLike } from "@workspace/agent-runtime";
import { formatResendSender } from "@workspace/utils";
import { Resend } from "resend";

import { describeSendFailure } from "./classify-resend-error.js";
import type { DeliveryConfig } from "./config-schema.js";
import { buildNewsletterMessageId } from "./message-id.js";
import { buildNewsletterRenderInput } from "./newsletter-render-input.js";
import { createSendRateLimiter, type SendRateLimiter } from "./rate-limiter.js";
import { buildSendPayload } from "./send-payload.js";
import { sendWithResendRetry } from "./send-with-resend-retry.js";
import {
  buildUnsubscribeLinks,
  type UnsubscribeSettings,
} from "./unsubscribe-links.js";

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

/** DeliveryConfig augmented with the env-sourced unsubscribe settings a run needs. */
export type DeliveryRunConfig = DeliveryConfig & {
  unsubscribe: UnsubscribeSettings;
  day1FirstIssueUserTickerIds: string[];
};

export type DeliverNewsletterDependencies = {
  resend: Resend;
  rateLimiter?: SendRateLimiter;
  logger?: LoggerLike;
  sendWithRetry?: typeof sendWithResendRetry;
  renderEmail?: typeof renderNewsletterEmail;
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
  const renderEmail = dependencies.renderEmail ?? renderNewsletterEmail;
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
  const releaseClaimQuietly = async (
    userTickerId: string,
    recipientRef: string,
  ): Promise<void> => {
    if (!releaseRecipient) {
      return;
    }
    try {
      await releaseRecipient(userTickerId);
    } catch (releaseError) {
      logger?.error?.(
        { recipientRef, err: releaseError },
        "delivery claim release failed",
      );
    }
  };

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

    const { unsubscribeUrl, oneClickUnsubscribeUrl } = buildUnsubscribeLinks({
      userTickerId: sub.userTickerId,
      tickerSymbol: newsletter.symbol,
      language: sub.language,
      settings: config.unsubscribe,
    });

    const renderStart = Date.now();
    const emailTitle = parseNewsletterEmailSubject(localizedSubject).title;
    const renderInput = buildNewsletterRenderInput({
      userTickerId: sub.userTickerId,
      language: sub.language,
      title: emailTitle,
      bodyText: localizedContent,
      unsubscribeUrl,
      tickerSymbol: newsletter.symbol,
      template: config.template,
      day1FirstIssueUserTickerIds: config.day1FirstIssueUserTickerIds,
    });
    let rendered: { html: string; text: string };
    try {
      rendered = await renderEmail(renderInput);
    } catch (renderError) {
      const message =
        renderError instanceof Error
          ? renderError.message
          : String(renderError);
      logger?.error?.(
        { recipientRef: ref, err: renderError, variant: renderInput.variant },
        "delivery render failed",
      );
      await releaseClaimQuietly(sub.userTickerId, ref);
      results.push({
        userTickerId: sub.userTickerId,
        status: "failed",
        attempts: 0,
        lastErrorCode: "render_error",
        lastErrorMessage: message.slice(0, 500),
        errorCategory: "render_error",
      });
      continue;
    }
    const { html, text } = rendered;
    logger?.info?.(
      {
        ms: Date.now() - renderStart,
        newsletterId: newsletter.id,
        recipientRef: ref,
        variant: renderInput.variant,
      },
      "delivery newsletter render timing",
    );

    const payload = buildSendPayload({
      config,
      from,
      to: sub.email,
      subject: localizedSubject,
      html,
      text,
      oneClickUnsubscribeUrl,
      messageId: buildNewsletterMessageId(
        newsletter.id,
        sub.userTickerId,
        from,
      ),
    });

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
      const failure = describeSendFailure(err, config.retry.maxAttempts);
      logger?.error?.(
        {
          recipientRef: ref,
          err,
          errorCategory: failure.errorCategory,
          resendErrorName: failure.resendErrorName,
        },
        "delivery send failed",
      );
      await releaseClaimQuietly(sub.userTickerId, ref);
      results.push({
        userTickerId: sub.userTickerId,
        status: "failed",
        attempts: failure.attempts,
        lastErrorCode: failure.lastErrorCode,
        lastErrorMessage: failure.lastErrorMessage,
        errorCategory: failure.errorCategory,
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
