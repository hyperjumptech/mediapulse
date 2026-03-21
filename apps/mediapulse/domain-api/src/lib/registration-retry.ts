/** Max attempts when registering this integration with Hermes on startup. */
export const REGISTRATION_MAX_ATTEMPTS = 6;

/** Base delay (ms) for the first registration retry backoff step. */
export const REGISTRATION_INITIAL_DELAY_MS = 1_000;

/** Upper bound (ms) for registration retry backoff. */
export const REGISTRATION_MAX_DELAY_MS = 30_000;

/**
 * Waits for a specified delay.
 *
 * @param delayMs - Milliseconds to wait.
 * @returns Promise that resolves after the delay.
 */
export const sleep = async (delayMs: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
};

/**
 * Returns the exponential backoff delay for a registration attempt.
 *
 * @param attempt - 1-based attempt number.
 * @returns Backoff delay in milliseconds, capped by max delay.
 */
export const getBackoffDelayMs = (attempt: number): number => {
  const delay = REGISTRATION_INITIAL_DELAY_MS * 2 ** Math.max(0, attempt - 1);
  return Math.min(delay, REGISTRATION_MAX_DELAY_MS);
};

/**
 * Determines whether registration should retry for the given response status.
 *
 * @param status - HTTP status code.
 * @returns True when the status is transient and worth retrying.
 */
export const shouldRetryStatus = (status: number): boolean => {
  return status === 429 || status >= 500;
};
