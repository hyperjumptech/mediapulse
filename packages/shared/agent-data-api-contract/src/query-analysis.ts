import { z } from "zod";

export const getQueryAnalysisQuerySchema = z.object({
  tickerId: z.string().trim().min(1),
});

export const postQueryAnalysisBodySchema = z.object({
  tickerId: z.string().trim().min(1),
  queries: z.array(
    z.object({
      text: z.string().trim().min(1),
    }),
  ),
});

export const queryAnalysisTickerSchema = z.object({
  id: z.string().uuid(),
  symbol: z.string(),
  name: z.string(),
  metadata: z.unknown().nullable(),
});

export const queryAnalysisTopEntitySchema = z.object({
  canonicalName: z.string(),
  typeName: z.string(),
  relevanceWeight: z.number(),
});

export const queryAnalysisRecentThemeSchema = z.object({
  theme: z.string(),
  articleCount: z.number().int().nonnegative(),
});

export const getQueryAnalysisResponseSchema = z.object({
  ticker: queryAnalysisTickerSchema,
  topEntities: z.array(queryAnalysisTopEntitySchema),
  recentThemes: z.array(queryAnalysisRecentThemeSchema),
});

export const postQueryAnalysisResponseSchema = z.object({
  created: z.number().int().nonnegative(),
});

export type GetQueryAnalysisQuery = z.infer<typeof getQueryAnalysisQuerySchema>;
export type PostQueryAnalysisBody = z.infer<typeof postQueryAnalysisBodySchema>;
export type GetQueryAnalysisResponse = z.infer<
  typeof getQueryAnalysisResponseSchema
>;
export type PostQueryAnalysisResponse = z.infer<
  typeof postQueryAnalysisResponseSchema
>;
