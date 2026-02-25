import { z } from "zod";

export const getContentGenerationQuerySchema = z.object({
  tickerId: z.string().uuid(),
});

export const postContentGenerationBodySchema = z.object({
  subject: z.string(),
  description: z.string().optional(),
  content: z.string(),
  tickerId: z.string().uuid(),
});

export type GetContentGenerationQuery = z.infer<
  typeof getContentGenerationQuerySchema
>;
export type PostContentGenerationBody = z.infer<
  typeof postContentGenerationBodySchema
>;
