import { z } from "zod";

/** Newsletter delivery language (mirrors the Prisma `Language` enum). */
export const newsletterLanguageSchema = z.enum(["en", "id"]);

export const postNewsletterTranslationBodySchema = z.object({
  newsletterId: z.string().uuid(),
  language: newsletterLanguageSchema,
  subject: z.string(),
  content: z.string(),
  model: z.string().optional(),
  promptTokens: z.number().int().nonnegative().optional(),
  completionTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
});

export const postNewsletterTranslationResponseSchema = z.object({
  message: z.string(),
});

export type NewsletterLanguage = z.infer<typeof newsletterLanguageSchema>;
export type PostNewsletterTranslationBody = z.infer<
  typeof postNewsletterTranslationBodySchema
>;
export type PostNewsletterTranslationResponse = z.infer<
  typeof postNewsletterTranslationResponseSchema
>;
