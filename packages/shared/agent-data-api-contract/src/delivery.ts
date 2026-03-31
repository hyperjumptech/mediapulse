import { z } from "zod";

export const getDeliveryQuerySchema = z.object({
  tickerId: z.string().trim().min(1),
});

export const postDeliveryBodySchema = z.object({
  userTickerId: z.string(),
});

export const deliveryNewsletterSchema = z.object({
  subject: z.string(),
  content: z.string(),
});

export const deliverySubscriberSchema = z.object({
  email: z.string().email(),
});

export const getDeliveryResponseSchema = z.object({
  newsletter: deliveryNewsletterSchema,
  subscribers: z.array(deliverySubscriberSchema),
});

export const postDeliveryResponseSchema = z.object({
  message: z.string(),
});

export type GetDeliveryQuery = z.infer<typeof getDeliveryQuerySchema>;
export type PostDeliveryBody = z.infer<typeof postDeliveryBodySchema>;
export type GetDeliveryResponse = z.infer<typeof getDeliveryResponseSchema>;
export type PostDeliveryResponse = z.infer<typeof postDeliveryResponseSchema>;
