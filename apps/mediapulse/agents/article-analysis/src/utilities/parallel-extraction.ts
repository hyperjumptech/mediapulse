/** Outcome for one item processed by {@link runExtractionsInParallel}. */
export type ParallelExtractionItemOutcome<R> =
  | { ok: true; index: number; value: R }
  | { ok: false; index: number; error: unknown };

/** Runtime stats collected while walking items with a concurrency cap. */
export type ParallelExtractionWalkStats = {
  peakInFlight: number;
  extractionSkippedDueToDeadline: number;
  deadlineFiredAtMs?: number;
};

/** Options for bounded parallel extraction with an optional dispatch deadline. */
export type RunExtractionsInParallelOptions<T> = {
  /** Max in-flight worker calls at once (minimum 1). */
  concurrency: number;
  /** When `Date.now() >= deadlineAtMs`, no new items are dispatched. */
  deadlineAtMs?: number;
  /** Invoked once per item not started because the deadline already passed. */
  onDeadlineSkip?: (item: T, index: number) => void;
};

/** Result of {@link runExtractionsInParallel}. */
export type ParallelExtractionWalkResult<R> = {
  results: ParallelExtractionItemOutcome<R>[];
  stats: ParallelExtractionWalkStats;
};

/**
 * Runs an async worker over items with bounded concurrency and an optional deadline.
 * Items past `deadlineAtMs` are not started; in-flight work is awaited to completion.
 * Worker rejections are captured as `{ ok: false, error }` and do not abort the walk.
 *
 * @param items - Inputs in deterministic batch order.
 * @param worker - Per-item async processor.
 * @param options - Concurrency limit, optional deadline, and skip callback.
 * @returns Fulfilled/rejected outcomes plus walk stats (`peakInFlight`, deadline skips).
 */
export const runExtractionsInParallel = async <T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
  options: RunExtractionsInParallelOptions<T>,
): Promise<ParallelExtractionWalkResult<R>> => {
  const concurrency = Math.max(1, options.concurrency);
  const results: ParallelExtractionItemOutcome<R>[] = [];
  let peakInFlight = 0;
  let inFlight = 0;
  let extractionSkippedDueToDeadline = 0;
  let deadlineFiredAtMs: number | undefined;
  let nextDispatchIndex = 0;

  const isPastDeadline = (): boolean =>
    options.deadlineAtMs !== undefined && Date.now() >= options.deadlineAtMs;

  const wrapWorker = async (
    item: T,
    index: number,
  ): Promise<ParallelExtractionItemOutcome<R>> => {
    try {
      const value = await worker(item, index);
      return { ok: true, index, value };
    } catch (error) {
      return { ok: false, index, error };
    }
  };

  if (items.length === 0) {
    return {
      results: [],
      stats: {
        peakInFlight: 0,
        extractionSkippedDueToDeadline: 0,
      },
    };
  }

  await new Promise<void>((resolve) => {
    const maybeFinish = (): void => {
      const allDispatchedOrSkipped = nextDispatchIndex >= items.length;
      if (allDispatchedOrSkipped && inFlight === 0) {
        resolve();
      }
    };

    const dispatchWhileCapacity = (): void => {
      while (inFlight < concurrency && nextDispatchIndex < items.length) {
        if (isPastDeadline()) {
          if (deadlineFiredAtMs === undefined) {
            deadlineFiredAtMs = Date.now();
          }
          while (nextDispatchIndex < items.length) {
            const skippedIndex = nextDispatchIndex;
            options.onDeadlineSkip?.(items[skippedIndex]!, skippedIndex);
            extractionSkippedDueToDeadline += 1;
            nextDispatchIndex += 1;
          }
          break;
        }

        const index = nextDispatchIndex;
        const item = items[index]!;
        nextDispatchIndex += 1;
        inFlight += 1;
        peakInFlight = Math.max(peakInFlight, inFlight);

        void wrapWorker(item, index).then((outcome) => {
          results.push(outcome);
          inFlight -= 1;
          dispatchWhileCapacity();
          maybeFinish();
        });
      }

      maybeFinish();
    };

    dispatchWhileCapacity();
  });

  results.sort((a, b) => a.index - b.index);

  return {
    results,
    stats: {
      peakInFlight,
      extractionSkippedDueToDeadline,
      ...(deadlineFiredAtMs !== undefined ? { deadlineFiredAtMs } : {}),
    },
  };
};
