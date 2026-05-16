import {
  parseIndustryNewsletterWireV2,
  type IndustryV2ParsedNewsletterBody,
} from "./parse-industry-newsletter-wire-v2.js";

/** Visible label used for the per-item source link emitted by the content generator. */
const READ_FULL_ARTICLE_LABEL = "Read the full article";

/** Matches a trailing `Read the full article: <url>` line at the end of a summary block. */
const READ_FULL_ARTICLE_LINE_REGEX = new RegExp(
  String.raw`(?:^|\n)\s*` + READ_FULL_ARTICLE_LABEL + String.raw`:\s*(\S+)\s*$`,
  "i",
);

/** Matches a leading `N. <title>` line at the start of an item chunk. */
const ITEM_HEADING_REGEX = /^\s*(\d+)\.\s+(.+?)\s*(?:\n|$)/;

/** A single parsed top-news item. */
export interface ParsedTopNewsItem {
  /** Item number as written in the source body (e.g. `1`, `2`, `3`). */
  number: number;
  /** Item title text (the part after `N.` on the heading line). */
  title: string;
  /** Summary prose for the item, with any trailing source URL line removed. */
  summary: string;
  /**
   * Source article URL extracted from the trailing `Read the full article: <url>` line.
   * `undefined` when the body does not include a URL line for this item.
   */
  url?: string;
}

/**
 * Parsed structured sections extracted from a legacy newsletter body string
 * (`EXECUTIVE SUMMARY` / `---` / `TOP N NEWS`).
 */
export type LegacyParsedNewsletterBody = {
  format: "legacy";
  /** 2–3 sentence summary extracted after the EXECUTIVE SUMMARY marker. */
  executiveSummary: string;
  /** Numbered top news items with title, summary, and optional source URL. */
  topNewsItems: ParsedTopNewsItem[];
};

/** Union of supported structured newsletter bodies. */
export type ParsedNewsletterBody =
  | LegacyParsedNewsletterBody
  | IndustryV2ParsedNewsletterBody;

const EXECUTIVE_SUMMARY_MARKER = /^\s*EXECUTIVE\s+SUMMARY\s*$/im;
const TOP_NEWS_MARKER = /^\s*TOP\s+\d+\s+NEWS\s*$/im;
const SEPARATOR = "\n---\n";

/**
 * Splits a summary block into its prose and (optional) trailing
 * `Read the full article: <url>` line.
 *
 * @param block - Raw summary text captured between two numbered headings.
 * @returns The cleaned prose summary and the parsed URL when present.
 */
function extractSourceUrl(block: string): { summary: string; url?: string } {
  const trimmed = block.trim();
  const match = READ_FULL_ARTICLE_LINE_REGEX.exec(trimmed);
  if (match === null) {
    return { summary: trimmed };
  }
  const urlCandidate = match[1]?.trim() ?? "";
  const cleanedSummary = trimmed.slice(0, match.index).trim();
  if (urlCandidate.length === 0) {
    return { summary: cleanedSummary };
  }
  return { summary: cleanedSummary, url: urlCandidate };
}

/**
 * Parses a single `N. Title\nSummary lines...` chunk into a structured item.
 *
 * @param chunk - One item chunk separated by blank lines in the original body.
 * @returns Parsed item, or `undefined` when the chunk does not start with `N. Title`.
 */
function parseItemChunk(chunk: string): ParsedTopNewsItem | undefined {
  const headingMatch = ITEM_HEADING_REGEX.exec(chunk);
  if (headingMatch === null) {
    return undefined;
  }
  const numberStr = headingMatch[1];
  const title = headingMatch[2]?.trim();
  if (numberStr === undefined || title === undefined || title.length === 0) {
    return undefined;
  }
  const number = Number.parseInt(numberStr, 10);
  if (Number.isNaN(number)) {
    return undefined;
  }
  const remainder = chunk.slice(headingMatch[0].length);
  const { summary, url } = extractSourceUrl(remainder);
  if (summary.length === 0) {
    return undefined;
  }
  return {
    number,
    title,
    summary,
    ...(url !== undefined ? { url } : {}),
  };
}

/**
 * Parses the legacy executive-summary + top-news wire shape.
 *
 * @param bodyText - Raw newsletter body.
 * @returns Legacy structure without the `format` discriminator, or `undefined`.
 */
function parseLegacyNewsletterBodyInner(
  bodyText: string,
):
  | Pick<LegacyParsedNewsletterBody, "executiveSummary" | "topNewsItems">
  | undefined {
  const trimmed = bodyText.trim();

  const sepIndex = trimmed.indexOf(SEPARATOR);
  if (sepIndex === -1) {
    return undefined;
  }

  const beforeSep = trimmed.slice(0, sepIndex).trim();
  const afterSep = trimmed.slice(sepIndex + SEPARATOR.length).trim();

  const execMatch = EXECUTIVE_SUMMARY_MARKER.exec(beforeSep);
  if (execMatch === null) {
    return undefined;
  }

  const execSummaryStart = beforeSep.indexOf(execMatch[0] ?? "");
  const summaryText = beforeSep
    .slice(execSummaryStart + (execMatch[0]?.length ?? 0))
    .trim();

  if (summaryText.length === 0) {
    return undefined;
  }

  const topMatch = TOP_NEWS_MARKER.exec(afterSep);
  if (topMatch === null) {
    return undefined;
  }

  const itemsStart = afterSep.indexOf(topMatch[0] ?? "");
  const itemsBlock = afterSep
    .slice(itemsStart + (topMatch[0]?.length ?? 0))
    .trim();

  if (itemsBlock.length === 0) {
    return undefined;
  }

  const itemChunks = itemsBlock
    .split(/\n\s*\n+/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  const topNewsItems: ParsedTopNewsItem[] = [];
  for (const chunk of itemChunks) {
    const item = parseItemChunk(chunk);
    if (item !== undefined) {
      topNewsItems.push(item);
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

/**
 * Parses a newsletter body string into structured sections.
 * Returns `undefined` when the body does not follow a supported format,
 * allowing the caller to fall back to plain-text rendering.
 *
 * @param bodyText - Raw newsletter body (legacy or `MP_NEWSLETTER_V2` wire).
 * @returns Structured sections, or `undefined` when parsing fails.
 */
export function parseNewsletterBody(
  bodyText: string,
): ParsedNewsletterBody | undefined {
  const trimmedStart = bodyText.trimStart();
  if (trimmedStart.startsWith("MP_NEWSLETTER_V2")) {
    return parseIndustryNewsletterWireV2(bodyText);
  }

  const legacy = parseLegacyNewsletterBodyInner(bodyText);
  if (legacy === undefined) {
    return undefined;
  }
  return { format: "legacy", ...legacy };
}
