const BLOCKED_PATH_PATTERNS = [
  /\/quote(\/|$)/i,
  /\/financials(\/|$)/i,
  /\/key-statistics(\/|$)/i,
  /\/company(\/|$)/i,
  /\/company-profile(\/|$)/i,
  /\/management(\/|$)/i,
  /\/history(\/|$)/i,
  /\/forecast(\/|$)/i,
  /\/consensus(\/|$)/i,
  /\/calendar(\/|$)/i,
  /\/investor-relations(\/|$)/i,
] as const;

const BLOCKED_HOST_PATTERNS = [
  /(^|\.)linkedin\.com$/i,
  /(^|\.)youtube\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)tiktok\.com$/i,
  /(^|\.)reddit\.com$/i,
] as const;

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
 * @param sourceContent - Source content.
 * @returns Null for likely article content, otherwise a concrete non-article reason.
 */
export const classifyNonArticleSource = (
  sourceUrl: string,
  sourceTitle: string,
  _sourceContent: string,
): NonArticleReason | null => {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return null;
  }

  if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname))) {
    return "prefilter_blocked_host";
  }

  if (BLOCKED_PATH_PATTERNS.some((pattern) => pattern.test(parsed.pathname))) {
    return "prefilter_blocked_path";
  }

  const titleLower = sourceTitle.toLowerCase();
  if (NON_ARTICLE_TITLE_MARKERS.some((marker) => titleLower.includes(marker))) {
    return "prefilter_index_title";
  }

  return null;
};
