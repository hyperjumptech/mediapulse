import { z } from "zod";

import { containsNonLatinScript } from "./lib/sanitize-summary-points.js";

/** Longest subject line worth sending; inbox clients truncate well before this. */
export const MAX_SUBJECT_LENGTH = 48;

/** Subject used when no headline in the issue is fit to carry one. */
export const SUBJECT_FALLBACK_TEXT = "Your daily briefing";

/** Trailing punctuation left dangling once a title is cut at a word boundary. */
const DANGLING_TRAILING_PUNCTUATION = /[\s,;:.–—-]+$/u;

/** Structured output contract for the subject line. */
export const newsletterSubjectSchema = z.object({
  subject: z.string().trim().min(1).max(MAX_SUBJECT_LENGTH),
});

export type NewsletterSubject = z.infer<typeof newsletterSubjectSchema>;

/**
 * System prompt for the subject writer.
 *
 * This is the only step that sees the whole issue, so it is the only place that can weigh
 * one story against another. It gets titles alone, never article bodies.
 */
export const WRITE_SUBJECT_SYSTEM_PROMPT = `You write the subject line for a business newsletter, given the headlines it contains.

Return one subject of at most ${String(MAX_SUBJECT_LENGTH)} characters.

Name the most significant story in the list. Do not summarize the whole issue, and do not write a label like "Weekly roundup" or "Industry update".

Significance is judged from the reader's seat. The reader runs the issuer named in the context line, so prefer, in this order: the issuer's own results or actions; a rule or ruling that binds the issuer; a direct competitor's move in a market the issuer serves; a development across the issuer's industry. A story about a company in a different line of business from the issuer must never lead, however dramatic it is.

Do not add a ticker prefix; the system adds one.

Stay faithful to what the headlines claim. When a headline describes a forecast, a risk, or a possibility, keep it conditional: write "could surge" or "may rise", never "surges".

When the headlines point in opposite directions, name the specific tension rather than retreating to a neutral verb. "Spot price falls as reference price rises" beats "Prices change".

Write plainly. No colons splicing two ideas together, no clickbait, no questions.`;

/** Who the issue is for, so the writer can tell the issuer's news from a competitor's. */
export type SubjectIssuerContext = {
  symbol?: string | undefined;
  name?: string | undefined;
  industry?: string | undefined;
};

/** One shipped headline and the section it landed in. */
export type SubjectHeadline = {
  title: string;
  section?: string | undefined;
};

const renderIssuerLine = (issuer: SubjectIssuerContext): string | null => {
  const symbol = issuer.symbol?.trim();
  const name = issuer.name?.trim();
  if (!symbol && !name) {
    return null;
  }
  const who = symbol && name ? `${symbol} (${name})` : (symbol ?? name);
  const industry = issuer.industry?.trim();

  return industry
    ? `This issue is for ${String(who)}, which operates in ${industry}.`
    : `This issue is for ${String(who)}.`;
};

/**
 * Builds the user prompt from the shipped headlines.
 *
 * Each headline carries the section it landed in, so the writer can apply the ranking in the
 * system prompt instead of guessing which story concerns the issuer.
 *
 * @param headlines - Shipped headlines in render order, with their sections.
 * @param issuer - The issuer the newsletter is written for.
 * @returns Prompt text naming the issuer and listing the headlines.
 */
export const buildSubjectPrompt = (
  headlines: readonly (SubjectHeadline | string)[],
  issuer: SubjectIssuerContext = {},
): string => {
  const issuerLine = renderIssuerLine(issuer);
  const lines = headlines.map((headline) => {
    if (typeof headline === "string") {
      return `- ${headline}`;
    }

    return headline.section
      ? `- [${headline.section}] ${headline.title}`
      : `- ${headline.title}`;
  });

  return [
    ...(issuerLine ? [issuerLine, ""] : []),
    "Headlines in this issue:",
    "",
    ...lines,
  ].join("\n");
};

/**
 * Trims text to `limit` without splitting a word or a multi-byte character.
 *
 * - Important: uses `Intl.Segmenter` so the cut never lands inside a surrogate pair, which a plain
 *   `slice` on a UTF-16 index can do.
 *
 * @param text - Text to trim.
 * @param limit - Longest result in characters.
 * @returns The trimmed text, or the original when it already fits.
 */
export const truncateOnWordBoundary = (text: string, limit: number): string => {
  const trimmed = text.trim();
  if (trimmed.length <= limit) {
    return trimmed;
  }

  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
  let clipped = "";
  for (const { segment } of segmenter.segment(trimmed)) {
    if (clipped.length + segment.length > limit) {
      break;
    }
    clipped += segment;
  }

  const lastSpace = clipped.lastIndexOf(" ");
  const wordBounded = lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped;

  return wordBounded.replace(DANGLING_TRAILING_PUNCTUATION, "").trim();
};

/**
 * Builds the subject used when the subject model call fails after retries.
 *
 * Prefers the first headline written wholly in Latin script, because a stray Han or Kana token
 * ships as visibly broken text in an inbox, then trims it to the budget on a word boundary.
 *
 * @param titles - Titles of the articles in the issue, in render order.
 * @returns A subject-safe title, or {@link SUBJECT_FALLBACK_TEXT} when no headline is usable.
 */
export const buildSubjectFallback = (titles: readonly string[]): string => {
  for (const title of titles) {
    if (containsNonLatinScript(title)) {
      continue;
    }

    const candidate = truncateOnWordBoundary(title, MAX_SUBJECT_LENGTH);
    if (candidate.length > 0) {
      return candidate;
    }
  }

  return SUBJECT_FALLBACK_TEXT;
};
