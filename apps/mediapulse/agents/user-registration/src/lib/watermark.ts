const TERMINAL_SUCCESS_STATUSES = new Set([
  "confirmed_archived",
  "acknowledged_archived",
  "invalid_ticker_archived",
  "archived_unparseable",
]);

export type ProcessResult = {
  status: string;
  receivedDateTime?: string;
};

/**
 * Returns the safe watermark boundary after a batch run.
 *
 * Sorts results oldest-first, then walks the longest contiguous prefix where
 * every result is a terminal success with a known timestamp. The boundary is
 * the timestamp of the last message in that prefix. Results with no
 * `receivedDateTime` sort last and stop the prefix walk without extending it.
 *
 * - If no prefix exists (oldest result is `failed_retry` or has no timestamp),
 *   returns `previousWatermark` unchanged so no already-seen messages are skipped.
 * - Returns `undefined` when `previousWatermark` is `undefined` and no prefix exists.
 */
export function computeSafeWatermark(
  results: ProcessResult[],
  previousWatermark: string | undefined,
): string | undefined {
  const sorted = [...results].sort((a, b) => {
    if (!a.receivedDateTime && !b.receivedDateTime) return 0;
    if (!a.receivedDateTime) return 1;
    if (!b.receivedDateTime) return -1;
    return (
      new Date(a.receivedDateTime).getTime() -
      new Date(b.receivedDateTime).getTime()
    );
  });

  let boundary: string | undefined;
  for (const result of sorted) {
    if (!result.receivedDateTime) break;
    if (!TERMINAL_SUCCESS_STATUSES.has(result.status)) break;
    boundary = new Date(result.receivedDateTime).toISOString();
  }

  return boundary ?? previousWatermark;
}
