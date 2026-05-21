import { sanitizeSourceContentMarkdownUrls } from "./sanitize-source-content-markdown-urls.js";
import type { SourceForGeneration } from "../types.js";

/**
 * Truncates data sources to fit within configured character limits.
 *
 * Processing order:
 * 1. **URL hygiene:** each source's `content` is passed through
 *    {@link sanitizeSourceContentMarkdownUrls} to strip blob/data/localhost and other
 *    non-article markdown targets before truncation.
 * 2. Per-source truncation: each source's content is truncated from the **tail**
 *    to `maxCharsPerSource` characters. Sources within the limit are unchanged.
 * 3. Total context cap: if the combined content still exceeds `maxTotalContextChars`,
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

  const truncated: SourceForGeneration[] = sources.map((source) => {
    const cleaned = sanitizeSourceContentMarkdownUrls(source.content);
    const content =
      cleaned.length > maxCharsPerSource
        ? cleaned.slice(0, maxCharsPerSource)
        : cleaned;
    return {
      url: source.url,
      title: source.title,
      content,
      ...(source.publishedAt !== undefined
        ? { publishedAt: source.publishedAt }
        : {}),
    };
  });

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
      ...(truncated[0]!.publishedAt !== undefined
        ? { publishedAt: truncated[0]!.publishedAt }
        : {}),
    };
  }

  return truncated;
}
