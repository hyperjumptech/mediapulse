import type { CreateEmailOptions, Resend } from "resend";
import { withRetryCustomDelay } from "@workspace/utils";

import {
  classifyResendError,
  retryAfterMsFromError,
  retryAfterMsFromHeaders,
  type ResendApiErrorShape,
} from "./classify-resend-error.js";
import type { DeliveryConfig } from "./config-schema.js";

export type SendEmailPayload = {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
};

/**
 * Sleeps for the given duration (injectable for tests).
 *
 * @param ms - Milliseconds to wait.
 * @param sleepFn - Impl; defaults to `setTimeout` promise.
 */
export function sleepMs(
  ms: number,
  sleepFn: (delay: number) => Promise<void> = (d) =>
    new Promise((r) => setTimeout(r, d)),
): Promise<void> {
  return sleepFn(ms);
}

function throwWithResendContext(
  message: string,
  resendError: ResendApiErrorShape,
  headers: Record<string, string> | null,
): never {
  const err = new Error(message);
  Object.assign(err, {
    resendError,
    resendHeaders: headers,
  });
  throw err;
}

/**
 * Sends one email via Resend with bounded retries for transient / rate-limit errors.
 *
 * @param resend - Resend client instance.
 * @param payload - From, to, subject, html and/or text, optional reply-to and tags.
 * @param retry - Retry policy from delivery config.
 * @param dependencies.sleepFn - Optional sleep override for tests.
 * @returns Resend email id when accepted.
 */
export async function sendWithResendRetry(
  resend: Resend,
  payload: SendEmailPayload,
  retry: DeliveryConfig["retry"],
  dependencies: { sleepFn?: (ms: number) => Promise<void> } = {},
): Promise<{ id: string | undefined; attempts: number }> {
  const sleepFn = dependencies.sleepFn ?? sleepMs;
  let sendCount = 0;

  const isRetryable = (e: unknown): boolean =>
    classifyResendError(e) !== "non_retryable";

  try {
    const id = await withRetryCustomDelay(
      async () => {
        sendCount += 1;
        if (payload.html === undefined && payload.text === undefined) {
          throw new Error("Send payload requires html and/or text");
        }
        const emailPayload = {
          from: payload.from,
          to: payload.to,
          subject: payload.subject,
          ...(payload.html !== undefined ? { html: payload.html } : {}),
          ...(payload.text !== undefined ? { text: payload.text } : {}),
          ...(payload.replyTo !== undefined
            ? { replyTo: payload.replyTo }
            : {}),
          ...(payload.tags !== undefined && payload.tags.length > 0
            ? { tags: payload.tags }
            : {}),
        } as CreateEmailOptions;
        const { data, error, headers } = await resend.emails.send(emailPayload);
        if (error) {
          throwWithResendContext(error.message, error, headers);
        }
        return data?.id;
      },
      retry.maxAttempts,
      ({ attempt, error: err }) => {
        const hdr =
          typeof err === "object" && err !== null && "resendHeaders" in err
            ? (err as { resendHeaders?: Record<string, string> | null })
                .resendHeaders
            : undefined;
        const retryAfter =
          retryAfterMsFromHeaders(hdr ?? undefined) ??
          retryAfterMsFromError(err);
        const exp =
          retry.baseDelayMs * 2 ** (attempt - 1) > retry.maxDelayMs
            ? retry.maxDelayMs
            : retry.baseDelayMs * 2 ** (attempt - 1);
        let delay = Math.min(retry.maxDelayMs, retryAfter ?? exp);
        if (retry.jitter) {
          delay = Math.floor(delay * (0.5 + Math.random() * 0.5));
        }
        return delay;
      },
      isRetryable,
      { sleepFn },
    );
    return { id, attempts: sendCount };
  } catch (err) {
    throw Object.assign(err instanceof Error ? err : new Error(String(err)), {
      attempts: sendCount,
    });
  }
}
