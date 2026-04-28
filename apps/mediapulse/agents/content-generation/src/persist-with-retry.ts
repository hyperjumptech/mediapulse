import type { ResolvedPersistRetryConfig } from "./config-schema.js";
import { isRetryablePersistError } from "./is-retryable-persist-error.js";
import { retryWithBackoff } from "./lib/retry.js";

/** Newsletter payload for the agent-data-api create endpoint. */
export type NewsletterCreateBody = {
  subject: string;
  content: string;
  description?: string;
  tickerId: string;
};

/**
 * Persists a generated newsletter via agent-data-api with retry for transient errors.
 *
 * Uses exponential backoff with no jitter — the `persistRetry` config group omits
 * a jitter field by design (unlike `llmRetry`), per the PRD config shape.
 * Non-retryable 4xx errors fail on the first attempt without retrying.
 *
 * @param createFn - The SDK create function to wrap (DI for testability).
 * @param newsletter - Newsletter payload (subject, content, description, tickerId).
 * @param persistRetry - Resolved persist retry config from agent config.
 * @param options - Optional DI overrides for sleepFn (tests avoid real delays).
 * @returns The SDK response on success.
 * @throws The last error when retries are exhausted (5xx) or on first 4xx.
 */
export async function persistNewsletterWithRetry(
  createFn: (body: NewsletterCreateBody) => Promise<unknown>,
  newsletter: NewsletterCreateBody,
  persistRetry: ResolvedPersistRetryConfig,
  options: { sleepFn?: (ms: number) => Promise<void> } = {},
): Promise<unknown> {
  // No jitter in persistRetry — this is a deliberate PRD decision, not an oversight.
  // See config-schema.ts persistRetry comment and the MP-CGA-009 ticket.
  return retryWithBackoff(
    () => createFn(newsletter),
    {
      maxAttempts: persistRetry.maxAttempts,
      baseDelayMs: persistRetry.baseDelayMs,
      maxDelayMs: persistRetry.maxDelayMs,
      jitter: false,
    },
    isRetryablePersistError,
    { sleepFn: options.sleepFn },
  );
}
