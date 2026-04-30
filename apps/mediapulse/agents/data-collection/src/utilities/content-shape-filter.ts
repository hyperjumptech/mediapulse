const NON_ARTICLE_MARKERS = [
  "key statistics",
  "historical data",
  "financial summary",
  "company profile",
  "market cap",
  "consensus estimates",
  "quote summary",
  "earnings revisions",
] as const;

const MIN_CONTENT_LENGTH = 180;
const MAX_LINK_DENSITY = 0.08;

export type ContentShapeDecision =
  | { blocked: true; reason: "content_link_farm" | "content_index_like" }
  | { blocked: false };

/**
 * Detects non-article content shapes using lightweight deterministic heuristics.
 *
 * @param title - Page title.
 * @param content - Fetched page body.
 * @returns Decision indicating whether content should be excluded before persistence.
 */
export const classifyNonArticleContent = (
  title: string,
  content: string,
): ContentShapeDecision => {
  const normalized = content.trim();
  const words = normalized
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
  const links = (normalized.match(/https?:\/\/|www\./gi) ?? []).length;
  const linkDensity = words === 0 ? 0 : links / words;
  if (linkDensity > MAX_LINK_DENSITY) {
    return { blocked: true, reason: "content_link_farm" };
  }

  const haystack = `${title}\n${normalized}`.toLowerCase();
  const markerHits = NON_ARTICLE_MARKERS.filter((marker) =>
    haystack.includes(marker),
  ).length;
  if (markerHits >= 2 && normalized.length >= MIN_CONTENT_LENGTH) {
    return { blocked: true, reason: "content_index_like" };
  }

  if (markerHits >= 1 && normalized.length < MIN_CONTENT_LENGTH) {
    return { blocked: true, reason: "content_index_like" };
  }

  return { blocked: false };
};
