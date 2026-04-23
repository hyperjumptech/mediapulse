import { z } from "zod";

export const getContentGenerationQuerySchema = z.object({
  tickerId: z.string().trim().min(1),
});

export const postContentGenerationBodySchema = z.object({
  subject: z.string(),
  description: z.string().optional(),
  content: z.string(),
  tickerId: z.string().trim().min(1),
  model: z.string().optional(),
  agentVersion: z.string().optional(),
  configVersion: z.string().optional(),
  promptHash: z.string().optional(),
  configSnapshotId: z.string().optional(),
  promptTokens: z.number().int().nonnegative().optional(),
  completionTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
});

export const contentGenerationDataSourceSchema = z
  .object({
    url: z.string(),
    title: z.string(),
    content: z.string(),
    tickerId: z.string().trim().min(1),
    searchQueryId: z.string().uuid(),
    description: z.string().nullable().optional(),
  })
  .passthrough();

export const getContentGenerationResponseSchema = z.object({
  dataSources: z.array(contentGenerationDataSourceSchema),
});

export const postContentGenerationResponseSchema = z.object({
  message: z.string(),
});

export type GetContentGenerationQuery = z.infer<
  typeof getContentGenerationQuerySchema
>;
export type PostContentGenerationBody = z.infer<
  typeof postContentGenerationBodySchema
>;
export type GetContentGenerationResponse = z.infer<
  typeof getContentGenerationResponseSchema
>;
export type PostContentGenerationResponse = z.infer<
  typeof postContentGenerationResponseSchema
>;
