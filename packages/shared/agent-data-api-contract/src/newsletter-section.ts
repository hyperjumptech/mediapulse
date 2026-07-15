import { z } from "zod";

export const NEWSLETTER_SECTIONS_MAX = 20;
export const NEWSLETTER_SECTION_ITEMS_MAX = 50;

export const newsletterSectionItemSchema = z.object({
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  url: z.string().trim().min(1).nullable(),
  dataSourceId: z.string().uuid().nullable(),
  position: z.number().int().nonnegative(),
});

export const newsletterSectionSchema = z.object({
  sectionKey: z.string().trim().min(1),
  heading: z.string().trim().min(1),
  summary: z.string().trim().min(1).nullable(),
  position: z.number().int().nonnegative(),
  items: z.array(newsletterSectionItemSchema).max(NEWSLETTER_SECTION_ITEMS_MAX),
});

export const postContentGenerationSectionsBodySchema = z.object({
  newsletterId: z.string().uuid(),
  sections: z
    .array(newsletterSectionSchema)
    .min(1)
    .max(NEWSLETTER_SECTIONS_MAX),
});

export const postContentGenerationSectionsResponseSchema = z.object({
  recordedSectionCount: z.number().int().nonnegative(),
});

export type NewsletterSectionItem = z.infer<typeof newsletterSectionItemSchema>;
export type NewsletterSection = z.infer<typeof newsletterSectionSchema>;
export type PostContentGenerationSectionsBody = z.infer<
  typeof postContentGenerationSectionsBodySchema
>;
export type PostContentGenerationSectionsResponse = z.infer<
  typeof postContentGenerationSectionsResponseSchema
>;
