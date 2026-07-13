import { z } from "zod";

export const NEWSLETTER_CITATIONS_MAX = 200;

export const newsletterCitationItemSchema = z.object({
  dataSourceId: z.string().uuid(),
  sectionKey: z.string().trim().min(1),
});

export const postContentGenerationCitationsBodySchema = z.object({
  newsletterId: z.string().uuid(),
  citations: z
    .array(newsletterCitationItemSchema)
    .min(1)
    .max(NEWSLETTER_CITATIONS_MAX),
});

export const postContentGenerationCitationsResponseSchema = z.object({
  recordedCount: z.number().int().nonnegative(),
});

export type NewsletterCitationItem = z.infer<
  typeof newsletterCitationItemSchema
>;
export type PostContentGenerationCitationsBody = z.infer<
  typeof postContentGenerationCitationsBodySchema
>;
export type PostContentGenerationCitationsResponse = z.infer<
  typeof postContentGenerationCitationsResponseSchema
>;
