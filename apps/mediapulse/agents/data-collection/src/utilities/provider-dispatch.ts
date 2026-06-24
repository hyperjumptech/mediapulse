/**
 * Round-robin provider dispatch with failover.
 *
 * Ported from the reference `agentic-mediapulse` `dispatch.py`. A per-capability
 * cursor rotates which provider is tried first on each request, so load and
 * rate-limit pressure spread across the pool instead of always hitting the first
 * provider. On failure the remaining providers are tried in rotation order.
 */

/** Raised when every provider in the pool threw for one request. */
export class AllProvidersFailed extends Error {
  readonly capability: string;
  readonly errors: Array<{ provider: string; message: string }>;

  constructor(
    capability: string,
    errors: Array<{ provider: string; message: string }>,
  ) {
    const detail = errors
      .map((entry) => `${entry.provider}: ${entry.message}`)
      .join("; ");
    super(`All ${capability} providers failed: ${detail}`);
    this.name = "AllProvidersFailed";
    this.capability = capability;
    this.errors = errors;
  }
}

/** A named unit of work that can be dispatched (a search or fetch provider). */
export interface DispatchProvider<TResult> {
  readonly name: string;
  run: () => Promise<TResult>;
}

/** Per-capability rotating cursor. Increments once per dispatch call. */
export class RoundRobinCursor {
  private readonly cursors = new Map<string, number>();

  /** Returns the starting offset for `capability` and advances the cursor. */
  next(capability: string): number {
    const start = this.cursors.get(capability) ?? 0;
    this.cursors.set(capability, start + 1);

    return start;
  }
}

/**
 * Tries providers in rotation, returning the first accepted result.
 *
 * - Thrown errors are collected and the next provider is tried.
 * - Returns the first result where `accept(result)` is true.
 * - If every provider ran but none was accepted, returns the last result (graceful degrade).
 * - If every provider threw, throws {@link AllProvidersFailed}.
 *
 * @param capability - Logical pool name (for example `"search"` or `"fetch"`).
 * @param providers - Provider pool for this request.
 * @param accept - Predicate deciding whether a result is good enough to return.
 * @param cursor - Shared rotating cursor; advanced once per call.
 */
export async function dispatch<TResult>(
  capability: string,
  providers: DispatchProvider<TResult>[],
  accept: (result: TResult) => boolean,
  cursor: RoundRobinCursor,
): Promise<TResult> {
  if (providers.length === 0) {
    throw new AllProvidersFailed(capability, []);
  }

  const start = cursor.next(capability);
  const errors: Array<{ provider: string; message: string }> = [];
  let lastResult: TResult | undefined;
  let sawResult = false;

  for (let offset = 0; offset < providers.length; offset += 1) {
    const provider = providers[(start + offset) % providers.length]!;
    try {
      const result = await provider.run();
      if (accept(result)) {
        return result;
      }
      lastResult = result;
      sawResult = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ provider: provider.name, message });
    }
  }

  if (sawResult) {
    return lastResult as TResult;
  }

  throw new AllProvidersFailed(capability, errors);
}
