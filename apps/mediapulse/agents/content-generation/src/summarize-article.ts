import {
  MAX_POINTS_PER_ARTICLE,
  MAX_POINT_LENGTH,
} from "@workspace/email-templates/newsletter-document";
import { z } from "zod";

import type { SourceForGeneration } from "./types.js";

/** Structured output contract for a single article summary. */
export const articleSummarySchema = z.object({
  points: z
    .array(z.string().trim().min(1).max(MAX_POINT_LENGTH))
    .min(1)
    .max(MAX_POINTS_PER_ARTICLE),
});

export type ArticleSummary = z.infer<typeof articleSummarySchema>;

/**
 * System prompt for the per-article summarizer.
 *
 * The model sees one article and nothing else. It does not choose a section, write a
 * title, or know what the rest of the newsletter contains, so none of that belongs here.
 */
export const SUMMARIZE_ARTICLE_SYSTEM_PROMPT = `You extract the key facts from a single news article for a business newsletter.

Return between 1 and ${String(MAX_POINTS_PER_ARTICLE)} points. Each point must be at most ${String(MAX_POINT_LENGTH)} characters.

Write only what the article actually says. Do not add figures, companies, dates, causes, or consequences that are not stated in it. Do not infer why something happened when the article does not say. If you are unsure whether the article supports a claim, leave it out.

Lead with the concrete thing: the number, the name, the decision, the change. Cut throat-clearing ("The article reports that", "It is worth noting"), scene-setting, and hedging. Use plain language a busy reader understands at a glance, and expand jargon the first time it appears.

One fact per point. No bullet characters, no leading dashes, no trailing citations.

Write as many points as the article earns and no more. Most articles carry one or two things worth knowing. Never pad to reach ${String(MAX_POINTS_PER_ARTICLE)}.`;

/**
 * Builds the user prompt for one article.
 *
 * @param source - The article to summarize.
 * @returns Prompt text carrying the article's title and body.
 */
export const buildArticlePrompt = (source: SourceForGeneration): string =>
  [`Title: ${source.title}`, "", "Article:", source.content.trim()].join("\n");
