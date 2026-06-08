export type PMapOptions = {
  concurrency: number;
};

/**
 * Maps `items` with bounded concurrency while preserving input order in the result.
 *
 * @param items - Values to map.
 * @param mapper - Async mapper invoked for each item.
 * @param options - Concurrency ceiling for in-flight mappers.
 * @returns Mapped values in the same order as `items`.
 */
export const pMap = async <T, R>(
  items: readonly T[],
  mapper: (item: T, index: number) => Promise<R>,
  options: PMapOptions,
): Promise<R[]> => {
  const { concurrency } = options;
  if (!Number.isFinite(concurrency) || concurrency < 1) {
    throw new Error(
      `pMap: concurrency must be a finite number >= 1 (got ${String(concurrency)})`,
    );
  }

  if (items.length === 0) {
    return [];
  }

  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await mapper(items[index] as T, index);
    }
  };

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
};
