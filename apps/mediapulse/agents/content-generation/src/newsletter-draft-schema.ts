import {
  MAX_ARTICLES_PER_SECTION,
  MAX_POINTS_PER_ARTICLE,
  MAX_POINT_LENGTH,
  NEWSLETTER_SECTION_KEYS,
} from "@workspace/email-templates/newsletter-document";
import { z } from "zod";

/** 1-based index into the numbered `Article N:` list in the user prompt. */
const articleIndexSchema = z.number().int().positive();

/**
 * One article as authored by the model.
 *
 * The model never writes URLs or bylines. It cites a source by `articleIndex` and
 * {@link resolveNewsletterDraft} attaches the grounded url, author, and source from
 * the Hermes source row.
 */
export const newsletterDraftArticleSchema = z.object({
  title: z.string().trim().min(1),
  points: z
    .array(z.string().trim().min(1).max(MAX_POINT_LENGTH))
    .min(1)
    .max(MAX_POINTS_PER_ARTICLE),
  articleIndex: articleIndexSchema,
});

export const newsletterDraftSectionSchema = z.object({
  key: z.enum(NEWSLETTER_SECTION_KEYS),
  articles: z
    .array(newsletterDraftArticleSchema)
    .min(1)
    .max(MAX_ARTICLES_PER_SECTION),
});

/**
 * Structured output contract for newsletter generation.
 *
 * Every field is required, which satisfies OpenAI strict JSON-schema rules without the
 * nullable-then-transform dance the previous schema needed.
 */
export const newsletterDraftSchema = z.object({
  subject: z.string().trim().min(1),
  sections: z.array(newsletterDraftSectionSchema).min(1),
});

export type NewsletterDraft = z.infer<typeof newsletterDraftSchema>;
export type NewsletterDraftArticle = z.infer<
  typeof newsletterDraftArticleSchema
>;
