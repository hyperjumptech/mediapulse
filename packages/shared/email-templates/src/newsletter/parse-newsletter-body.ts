/**
 * Parsed structured sections extracted from a newsletter body string.
 */
export interface ParsedNewsletterBody {
  /** 2–3 sentence summary extracted after the EXECUTIVE SUMMARY marker. */
  executiveSummary: string;
  /** Numbered top news items with title and summary. */
  topNewsItems: Array<{ number: number; title: string; summary: string }>;
}

const EXECUTIVE_SUMMARY_MARKER = /^\s*EXECUTIVE\s+SUMMARY\s*$/im;
const TOP_NEWS_MARKER = /^\s*TOP\s+\d+\s+NEWS\s*$/im;
const SEPARATOR = "\n---\n";

/**
 * Parses a newsletter body string into structured executive-summary and top-news sections.
 * Returns `undefined` when the body does not follow the expected format,
 * allowing the caller to fall back to plain-text rendering.
 *
 * @param bodyText - Raw newsletter body following the `EXECUTIVE SUMMARY / --- / TOP N NEWS` format.
 * @returns Structured sections, or `undefined` when parsing fails.
 */
export function parseNewsletterBody(
  bodyText: string,
): ParsedNewsletterBody | undefined {
  const trimmed = bodyText.trim();

  // Locate the first separator
  const sepIndex = trimmed.indexOf(SEPARATOR);
  if (sepIndex === -1) {
    return undefined;
  }

  const beforeSep = trimmed.slice(0, sepIndex).trim();
  const afterSep = trimmed.slice(sepIndex + SEPARATOR.length).trim();

  // Match EXECUTIVE SUMMARY marker at the start of the first block
  const execMatch = EXECUTIVE_SUMMARY_MARKER.exec(beforeSep);
  if (execMatch === null) {
    return undefined;
  }

  // Extract summary text after the marker line
  const execSummaryStart = beforeSep.indexOf(execMatch[0] ?? "");
  const summaryText = beforeSep
    .slice(execSummaryStart + (execMatch[0]?.length ?? 0))
    .trim();

  if (summaryText.length === 0) {
    return undefined;
  }

  // Match TOP N NEWS marker at the start of the second block
  const topMatch = TOP_NEWS_MARKER.exec(afterSep);
  if (topMatch === null) {
    return undefined;
  }

  // Extract news items after the marker
  const itemsStart = afterSep.indexOf(topMatch[0] ?? "");
  const itemsBlock = afterSep
    .slice(itemsStart + (topMatch[0]?.length ?? 0))
    .trim();

  if (itemsBlock.length === 0) {
    return undefined;
  }

  // Parse numbered items: "<number>. <title>\n<summary>"
  const itemRegex = /^(\d+)\.\s+(.+?)\n([\s\S]*?)(?=\n\d+\.\s|\n*$)/gm;
  const topNewsItems: ParsedNewsletterBody["topNewsItems"] = [];

  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemRegex.exec(itemsBlock)) !== null) {
    const numberStr = itemMatch[1];
    const title = itemMatch[2];
    const summary = itemMatch[3];

    if (
      numberStr !== undefined &&
      title !== undefined &&
      summary !== undefined &&
      title.trim().length > 0 &&
      summary.trim().length > 0
    ) {
      const number = Number.parseInt(numberStr, 10);
      topNewsItems.push({
        number,
        title: title.trim(),
        summary: summary.trim(),
      });
    }
  }

  if (topNewsItems.length === 0) {
    return undefined;
  }

  return {
    executiveSummary: summaryText,
    topNewsItems,
  };
}
