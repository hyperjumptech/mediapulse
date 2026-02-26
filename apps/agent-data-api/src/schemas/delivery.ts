import { z } from "zod";

export const getDeliveryQuerySchema = z.object({
  tickerId: z.string().uuid(),
});

export const postDeliveryBodySchema = z.object({
  userTickerId: z.string(),
});

export type GetDeliveryQuery = z.infer<typeof getDeliveryQuerySchema>;
export type PostDeliveryBody = z.infer<typeof postDeliveryBodySchema>;
