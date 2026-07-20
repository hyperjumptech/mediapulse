import { z } from "zod";

/** Longest subject line worth sending; inbox clients truncate well before this. */
export const MAX_SUBJECT_LENGTH = 48;

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
