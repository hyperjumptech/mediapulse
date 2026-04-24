import type { SourceForGeneration } from "../types.js";

/**
 * Truncates data sources to fit within configured character limits.
 *
 * Processing order:
 * 1. Per-source truncation: each source's content is truncated from the **tail**
 *    to `maxCharsPerSource` characters. Sources within the limit are unchanged.
 * 2. Total context cap: if the combined content still exceeds `maxTotalContextChars`,
 *    sources are dropped from the **end** of the list (preserving the relevance order
 *    from `getDataSourcesForTicker`, which returns most-relevant first) until the total
 *    fits. At least one source is always kept; if a single source exceeds the total
 *    limit, its content is truncated to `maxTotalContextChars`.
 *
 * @param sources - Data sources with title, url, and content.
 * @param maxCharsPerSource - Max characters per source (tail-truncated).
 * @param maxTotalContextChars - Max combined content characters across all sources.
 * @returns Sources with truncated/dropped content.
 */
export function truncateSources(
  sources: SourceForGeneration[],
  maxCharsPerSource: number,
  maxTotalContextChars: number,
): SourceForGeneration[] {
  if (sources.length === 0) {
    return sources;
  }

  const truncated: SourceForGeneration[] = sources.map((source) => ({
    url: source.url,
    title: source.title,
    content:
      source.content.length > maxCharsPerSource
        ? source.content.slice(0, maxCharsPerSource)
        : source.content,
  }));

  const totalChars = () =>
    truncated.reduce((sum, s) => sum + s.content.length, 0);

  while (truncated.length > 1 && totalChars() > maxTotalContextChars) {
    truncated.pop();
  }

  if (totalChars() > maxTotalContextChars) {
    truncated[0] = {
      url: truncated[0]!.url,
      title: truncated[0]!.title,
      content: truncated[0]!.content.slice(0, maxTotalContextChars),
    };
  }

  return truncated;
}
