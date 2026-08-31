import { z } from "zod";

/**
 * Character budget for a single summary point.
 *
 * This is a generation-time target, not a document rule: the summarizer schema and the
 * translation prompt hold the model to it, but a stored document that overshoots is still
 * valid and still delivered. A slightly long point is a wording problem, not a corrupt body.
 */
export const MAX_POINT_LENGTH = 100;

/** Maximum summary points per article. */
export const MAX_POINTS_PER_ARTICLE = 3;

/** Maximum articles in a single section. */
export const MAX_ARTICLES_PER_SECTION = 3;

/** Canonical section keys, in the order they are rendered. */
export const NEWSLETTER_SECTION_KEYS = [
  "industry-pulse",
  "issuer-performance",
  "issuer-news",
  "competitive-landscape",
  "deals-and-movements",
  "regulatory-policy-watch",
  "disruptors-or-tech",
  "quick-hits",
] as const;

export type NewsletterSectionKey = (typeof NEWSLETTER_SECTION_KEYS)[number];

/**
 * Absolute article URL.
 *
 * Restricted to http(s) because the value is rendered directly into an `href`, and a
 * `javascript:` or `data:` URL would otherwise validate and reach the reader.
 */
const articleUrlSchema = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), {
    message: "URL must use http or https",
  });

/** One cited article: its byline, its link, and up to three summary points. */
export const newsletterArticleSchema = z.object({
  title: z.string().trim().min(1),
  author: z.string().trim().min(1).optional(),
  source: z.string().trim().min(1).optional(),
  url: articleUrlSchema,
  points: z.array(z.string().trim().min(1)).min(1).max(MAX_POINTS_PER_ARTICLE),
});

export type NewsletterArticle = z.infer<typeof newsletterArticleSchema>;

/** One section: a canonical key and its articles. */
export const newsletterSectionSchema = z.object({
  key: z.enum(NEWSLETTER_SECTION_KEYS),
  articles: z
    .array(newsletterArticleSchema)
    .min(1)
    .max(MAX_ARTICLES_PER_SECTION),
});

export type NewsletterSection = z.infer<typeof newsletterSectionSchema>;

/**
 * A complete newsletter body.
 *
 * This is both the shape the generation agent produces via structured output and the
 * shape stored in `Newsletter.content`, so the document is never serialized to an
 * intermediate text format and never needs to be re-parsed from one.
 */
export const newsletterDocumentSchema = z.object({
  version: z.literal(1),
  sections: z.array(newsletterSectionSchema).min(1),
});

export type NewsletterDocument = z.infer<typeof newsletterDocumentSchema>;

/** Decodes a JSON string, reporting a zod issue instead of throwing on bad syntax. */
const jsonStringSchema = z.string().transform((value, ctx) => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Body is not valid JSON",
    });

    return z.NEVER;
  }
});

/** Validates a raw body string into a newsletter document in one pass. */
export const newsletterDocumentBodySchema = jsonStringSchema.pipe(
  newsletterDocumentSchema,
);

/**
 * Reads a stored newsletter body into a validated document.
 *
 * @param bodyText - Raw `Newsletter.content` string.
 * @returns The document, or `undefined` when the body is not a valid newsletter document.
 */
export const readNewsletterDocument = (
  bodyText: string,
): NewsletterDocument | undefined => {
  const result = newsletterDocumentBodySchema.safeParse(bodyText);

  return result.success ? result.data : undefined;
};
