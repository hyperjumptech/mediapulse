/**
 * Builds the plain-text newsletter body from structured executive summary and top news.
 *
 * @param executiveSummary - 2–3 sentence overview of the day's news.
 * @param topNews - Up to 3 items with title and brief summary.
 * @returns Formatted newsletter body string.
 */
export function formatNewsletterContent(
  executiveSummary: string,
  topNews: Array<{ title: string; summary: string }>,
): string {
  const topNewsSection = topNews
    .map((item, i) => `${i + 1}. ${item.title}\n${item.summary.trim()}`)
    .join("\n\n");
  return `EXECUTIVE SUMMARY\n\n${executiveSummary.trim()}\n\n---\n\nTOP 3 NEWS\n\n${topNewsSection}`;
}
