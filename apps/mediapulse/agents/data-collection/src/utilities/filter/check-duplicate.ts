/** Decision returned by a cheap deterministic filter check. */
export type FilterDecision = { keep: true } | { keep: false; reason: string };

/**
 * Drops a page whose canonical URL was already persisted this run.
 *
 * @param canonicalUrl - Canonical URL of the fetched page.
 * @param seen - Canonical URLs already persisted this run.
 */
export const checkDuplicate = (
  canonicalUrl: string,
  seen: ReadonlySet<string>,
): FilterDecision =>
  seen.has(canonicalUrl)
    ? { keep: false, reason: "duplicate" }
    : { keep: true };
