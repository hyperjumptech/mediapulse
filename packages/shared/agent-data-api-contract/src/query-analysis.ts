import { z } from "zod";

export const getQueryAnalysisQuerySchema = z.object({
  tickerId: z.string().uuid(),
});

export const postQueryAnalysisBodySchema = z.object({
  tickerId: z.string().uuid(),
  queries: z.array(
    z.object({
      text: z.string().trim().min(1),
      source: z.enum(["deterministic", "llm"]),
      intent: z.enum(["breaking", "kg_change", "fundamental"]),
      rank: z.number().int(),
    }),
  ),
  strategySnapshot: z.record(z.unknown()),
  agentJobId: z.string().optional().nullable(),
  activate: z.boolean(),
  generationSource: z.string().min(1),
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
  configSnapshot: z.object({
    queryCount: z.number(),
    allowedLanguages: z.array(z.string()),
    minDeterministicCount: z.number(),
    weightBreaking: z.number(),
    weightKgChange: z.number(),
    weightFundamental: z.number(),
    model: z.string(),
    maxTokens: z.number(),
  }),
});

export const postQueryAnalysisResponseSchema = z.object({
  created: z.number().int().nonnegative(),
  createdSetId: z.string().uuid(),
  activeSetId: z.string().uuid(),
});

export type GetQueryAnalysisQuery = z.infer<typeof getQueryAnalysisQuerySchema>;
export type PostQueryAnalysisBody = z.infer<typeof postQueryAnalysisBodySchema>;
export type GetQueryAnalysisResponse = z.infer<
  typeof getQueryAnalysisResponseSchema
>;
export type PostQueryAnalysisResponse = z.infer<
  typeof postQueryAnalysisResponseSchema
>;
