import { classifyNoisyUrl } from "@workspace/utils";

const NON_ARTICLE_TITLE_MARKERS = [
  "key statistics",
  "historical data",
  "financial summary",
  "company profile",
  "consensus estimates",
] as const;

export type NonArticleReason =
  | "prefilter_blocked_host"
  | "prefilter_blocked_path"
  | "prefilter_index_title";

/**
 * Classifies whether a source is clearly non-article before running extraction.
 *
 * @param sourceUrl - Data source URL.
 * @param sourceTitle - Source title.
 * @param sourceContent - Source content (unused; reserved for future heuristics).
 * @returns Null for likely article content, otherwise a concrete non-article reason.
 */
export const classifyNonArticleSource = (
  sourceUrl: string,
  sourceTitle: string,
  _sourceContent: string,
): NonArticleReason | null => {
  try {
    new URL(sourceUrl);
  } catch {
    return null;
  }

  const urlDecision = classifyNoisyUrl(sourceUrl);
  if (urlDecision.blocked) {
    if (urlDecision.reason === "blocked_host") {
      return "prefilter_blocked_host";
    }
    return "prefilter_blocked_path";
  }

  const titleLower = sourceTitle.toLowerCase();
  if (NON_ARTICLE_TITLE_MARKERS.some((marker) => titleLower.includes(marker))) {
    return "prefilter_index_title";
  }

  return null;
};
