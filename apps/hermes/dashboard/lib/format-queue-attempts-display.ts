/**
 * Human-readable DataQueue attempt label for schedule execution invocations.
 *
 * @param attempts - Synced `dataQueueAttempts`, or null/undefined when unknown (legacy jobs).
 * @param maxAttempts - Synced `dataQueueMaxAttempts`, or null/undefined when unknown.
 */
export const formatQueueAttemptsDisplay = (
  attempts: number | null | undefined,
  maxAttempts: number | null | undefined,
): string => {
  const a = attempts ?? null;
  const m = maxAttempts ?? null;
  if (a == null && m == null) {
    return "—";
  }
  if (a != null && m != null) {
    return `${a} / ${m}`;
  }
  if (a != null) {
    return String(a);
  }
  return `— / ${m}`;
};
