import { z } from "zod";

export const getQueryAnalysisQuerySchema = z.object({
  tickerId: z.string().uuid(),
});

export const queryAnalysisQueryItemSchema = z.object({
  text: z.string().trim().min(1),
  source: z.enum(["deterministic", "llm"]),
  intent: z.enum(["breaking", "kg_change", "fundamental"]),
  rank: z.number().int().nonnegative(),
});

export const postQueryAnalysisBodySchema = z.object({
  tickerId: z.string().uuid(),
  queries: z.array(queryAnalysisQueryItemSchema),
  strategySnapshot: z.record(z.unknown()),
  generationSource: z.string().min(1),
  agentJobId: z.string().optional(),
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
  globalConfigSnapshot: z.record(z.unknown()).optional(),
});

export const postQueryAnalysisResponseSchema = z.object({
  created: z.number().int().nonnegative(),
  setId: z.string().uuid(),
  activeSetId: z.string().uuid(),
});

export type GetQueryAnalysisQuery = z.infer<typeof getQueryAnalysisQuerySchema>;
export type QueryAnalysisQueryItem = z.infer<
  typeof queryAnalysisQueryItemSchema
>;
export type PostQueryAnalysisBody = z.infer<typeof postQueryAnalysisBodySchema>;
export type GetQueryAnalysisResponse = z.infer<
  typeof getQueryAnalysisResponseSchema
>;
export type PostQueryAnalysisResponse = z.infer<
  typeof postQueryAnalysisResponseSchema
>;
