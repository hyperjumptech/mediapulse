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

Do not add a ticker prefix; the system adds one.

Stay faithful to what the headlines claim. When a headline describes a forecast, a risk, or a possibility, keep it conditional: write "could surge" or "may rise", never "surges".

Write plainly. No colons splicing two ideas together, no clickbait, no questions.`;

/**
 * Builds the user prompt from the selected article titles.
 *
 * @param titles - Titles of the articles in the issue, in render order.
 * @returns Prompt text listing the headlines.
 */
export const buildSubjectPrompt = (titles: readonly string[]): string =>
  ["Headlines in this issue:", "", ...titles.map((title) => `- ${title}`)].join(
    "\n",
  );

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
