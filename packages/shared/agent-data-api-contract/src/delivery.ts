import { z } from "zod";

import { newsletterLanguageSchema } from "./newsletter-translation.js";

export const getDeliveryQuerySchema = z.object({
  tickerId: z.string().trim().min(1),
});

export const postDeliveryBodySchema = z.object({
  userTickerId: z.guid(),
  newsletterId: z.guid(),
  resendEmailId: z.string().min(1).optional(),
});

/** A translated rendering of the newsletter for a non-English subscription language. */
export const deliveryNewsletterTranslationSchema = z.object({
  language: newsletterLanguageSchema,
  subject: z.string(),
  content: z.string(),
});

export const deliveryNewsletterSchema = z.object({
  id: z.guid(),
  subject: z.string(),
  content: z.string(),
  symbol: z.string(),
  /** Non-English translations of this newsletter; empty when none exist yet. */
  translations: z.array(deliveryNewsletterTranslationSchema),
});

export const deliverySubscriberSchema = z.object({
  userTickerId: z.guid(),
  email: z.string().email(),
  /** Subscription language used to pick which rendered text the recipient receives. */
  language: newsletterLanguageSchema,
});

export const getDeliveryResponseSchema = z.object({
  newsletter: deliveryNewsletterSchema.nullable(),
  subscribers: z.array(deliverySubscriberSchema),
  /** User-ticker ids that already have a delivery checkpoint for the latest newsletter (skip send on replay). */
  deliveredUserTickerIds: z.array(z.guid()),
});

export const postDeliveryResponseSchema = z.object({
  message: z.string(),
});

export type DeliveryNewsletterTranslation = z.infer<
  typeof deliveryNewsletterTranslationSchema
>;
export type GetDeliveryQuery = z.infer<typeof getDeliveryQuerySchema>;
export type PostDeliveryBody = z.infer<typeof postDeliveryBodySchema>;
export type GetDeliveryResponse = z.infer<typeof getDeliveryResponseSchema>;
export type PostDeliveryResponse = z.infer<typeof postDeliveryResponseSchema>;
