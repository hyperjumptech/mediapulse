/**
 * Builds the plain-text newsletter body from structured executive summary and top news.
 *
 * @param executiveSummary - 2–3 sentence overview of the day's news.
 * @param topNews - Up to topNewsCount items with title and brief summary.
 * @param topNewsCount - Number of top news items for the section heading (default 3).
 * @returns Formatted newsletter body string.
 */
export function formatNewsletterContent(
  executiveSummary: string,
  topNews: Array<{ title: string; summary: string }>,
  topNewsCount: number = 3,
): string {
  const topNewsSection = topNews
    .map((item, i) => `${i + 1}. ${item.title}\n${item.summary.trim()}`)
    .join("\n\n");
  return `EXECUTIVE SUMMARY\n\n${executiveSummary.trim()}\n\n---\n\nTOP ${topNewsCount} NEWS\n\n${topNewsSection}`;
}
