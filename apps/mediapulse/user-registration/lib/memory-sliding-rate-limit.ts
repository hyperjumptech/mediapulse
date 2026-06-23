/**
 * In-process sliding-window rate limiting keyed by string.
 *
 * **Multi-instance:** Each Node process has its own buckets; horizontal scale
 * does not share state. Use an edge or Redis limiter in production if global
 * limits are required.
 */
const buckets = new Map<string, number[]>();

export type MemorySlidingRateLimitOptions = {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Maximum events allowed within the window. */
  max: number;
  /** Clock override for tests. */
  now?: () => number;
};

/**
 * Returns `true` if the key is under the limit (event recorded), `false` if rate limited.
 *
 * @param key - Stable bucket key (e.g. prefixed email hash or route name).
 * @param options - Window size and cap.
 */
export const checkMemorySlidingRateLimit = (
  key: string,
  options: MemorySlidingRateLimitOptions,
): boolean => {
  const now = options.now?.() ?? Date.now();
  const cutoff = now - options.windowMs;
  const prev = buckets.get(key) ?? [];
  const fresh = prev.filter((t) => t > cutoff);
  if (fresh.length >= options.max) {
    buckets.set(key, fresh);
    return false;
  }
  fresh.push(now);
  buckets.set(key, fresh);
  return true;
};

/**
 * Clears all buckets (intended for unit tests only).
 */
export const resetMemorySlidingRateLimitForTests = (): void => {
  buckets.clear();
};
