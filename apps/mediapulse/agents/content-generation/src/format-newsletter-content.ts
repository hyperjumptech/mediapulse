/** Visible label used for the per-item source link (also parsed back out by the email template). */
export const READ_FULL_ARTICLE_LABEL = "Read the full article";

/** A single top-news item, optionally carrying the source URL it was summarised from. */
export type TopNewsItem = {
  title: string;
  summary: string;
  /** Source article URL. When present, a `Read the full article: <url>` line is appended. */
  url?: string;
};

/**
 * Builds the plain-text newsletter body from structured executive summary and top news.
 *
 * Each top-news item is rendered as `N. <title>\n<summary>`, followed by a
 * deterministic `Read the full article: <url>` line when `item.url` is a
 * non-empty string. The trailing URL line lets `parseNewsletterBody` re-extract
 * the source URL on the rendering side, and keeps plain-text recipients with
 * a clickable source.
 *
 * @param executiveSummary - 2–3 sentence overview of the day's news.
 * @param topNews - Up to topNewsCount items with title, summary, and optional source URL.
 * @param topNewsCount - Number of top news items for the section heading (default 3).
 * @returns Formatted newsletter body string.
 */
export function formatNewsletterContent(
  executiveSummary: string,
  topNews: ReadonlyArray<TopNewsItem>,
  topNewsCount: number = 3,
): string {
  const topNewsSection = topNews
    .map((item, i) => {
      const trimmedUrl = item.url?.trim() ?? "";
      const sourceLine =
        trimmedUrl.length > 0
          ? `\n${READ_FULL_ARTICLE_LABEL}: ${trimmedUrl}`
          : "";
      return `${i + 1}. ${item.title}\n${item.summary.trim()}${sourceLine}`;
    })
    .join("\n\n");
  return `EXECUTIVE SUMMARY\n\n${executiveSummary.trim()}\n\n---\n\nTOP ${topNewsCount} NEWS\n\n${topNewsSection}`;
}
