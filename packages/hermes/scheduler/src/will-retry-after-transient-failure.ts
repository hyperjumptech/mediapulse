/**
 * Whether DataQueue will schedule another attempt after the current handler failure.
 * Compare `JobRecord.attempts` (after the lock increment) with `JobRecord.maxAttempts`.
 *
 * @param attempts - Current `attempts` on the queue job row while processing.
 * @param maxAttempts - Configured maximum attempts for the job.
 * @returns True if another try remains after this failure is recorded.
 */
export const willRetryAfterTransientFailure = (
  attempts: number,
  maxAttempts: number,
): boolean => attempts < maxAttempts;
