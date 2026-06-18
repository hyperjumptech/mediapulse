/**
 * Runs an Agent Data API call labeled with the originating page-collection step.
 *
 * When the call throws, the error is rewrapped so its message starts with
 * `Page collection step "<step>" failed: ` and the original error is preserved
 * on `cause`. This lets operators see *which* API endpoint failed instead of a
 * bare `Agent data API error: 500` with no context.
 *
 * @param step - Short human-readable step label (e.g. `persist articles`).
 * @param fn - Async work that calls into `dataApiClient.*`.
 * @returns Whatever `fn` returns on success.
 * @throws Error wrapped with the step label when `fn` rejects.
 */
export const withApiStep = async <T>(
  step: string,
  fn: () => Promise<T>,
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    const original = error instanceof Error ? error.message : String(error);
    const wrapped = new Error(
      `Page collection step "${step}" failed: ${original}`,
      { cause: error },
    );
    if (error instanceof Error && error.stack) {
      wrapped.stack = error.stack;
    }
    throw wrapped;
  }
};
