import { z } from "zod";

/** All supported query-analysis intent labels (contract source of truth). */
export const QUERY_ANALYSIS_INTENTS = [
  "breaking",
  "kg_change",
  "fundamental",
  "sentiment",
  "competitor",
  "supply_chain",
  "esg",
  "macro",
  "technical",
  "regulatory",
  "technology_trend",
  "geopolitical",
  "industry_trend",
  "deals",
  "wildcard",
] as const;

/** Intent labels used by the standard (non-wildcard) query-generation pipeline. */
export const QUERY_ANALYSIS_STANDARD_INTENTS = [
  "breaking",
  "kg_change",
  "sentiment",
  "competitor",
  "supply_chain",
  "esg",
  "macro",
  "technical",
  "regulatory",
  "technology_trend",
  "geopolitical",
  "industry_trend",
  "deals",
] as const;

export const queryAnalysisIntentSchema = z.enum(QUERY_ANALYSIS_INTENTS);

export type QueryAnalysisIntent = z.infer<typeof queryAnalysisIntentSchema>;

/** Default merge / sampling weights keyed by intent (new intents intentionally ≤ 0.5). */
export const DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS: Record<
  QueryAnalysisIntent,
  number
> = {
  breaking: 1,
  kg_change: 0.8,
  fundamental: 0,
  sentiment: 0.5,
  competitor: 0.7,
  supply_chain: 0.4,
  esg: 0.5,
  macro: 0.7,
  technical: 0.3,
  regulatory: 0.6,
  technology_trend: 0.55,
  geopolitical: 0.5,
  industry_trend: 0.6,
  deals: 0.65,
  wildcard: 0,
};

export const getQueryAnalysisQuerySchema = z.object({
  tickerId: z.string().trim().min(1),
});

export const queryAnalysisConfigSnapshotSchema = z.object({
  queryCount: z.number().int().positive(),
  allowedLanguages: z.array(z.string().trim().min(1)),
  minDeterministicCount: z.number().int().nonnegative(),
  /** @deprecated Prefer `intentWeights`; legacy snapshots may only include the original trio. */
  weights: z
    .object({
      breaking: z.number().nonnegative(),
      kgChange: z.number().nonnegative(),
      fundamental: z.number().nonnegative(),
    })
    .optional(),
  intentWeights: z
    .record(queryAnalysisIntentSchema, z.number().nonnegative())
    .optional(),
  model: z.string().trim().min(1).optional(),
  maxTokens: z.number().int().positive().optional(),
});

export const queryAnalysisRelationDeltaSchema = z.object({
  fromEntity: z.string().trim().min(1),
  toEntity: z.string().trim().min(1),
  relationType: z.string().trim().min(1),
  change: z.enum(["added", "removed", "updated"]),
  weight: z.number().optional(),
});

export const queryAnalysisPostQuerySchema = z.object({
  text: z.string().trim().min(1),
  intent: queryAnalysisIntentSchema,
  rank: z.number().int().positive(),
});

export const postQueryAnalysisBodySchema = z.object({
  tickerId: z.string().trim().min(1),
  queries: z.array(queryAnalysisPostQuerySchema).min(1),
  strategySnapshot: z.record(z.string(), z.unknown()),
  generationSource: z.string().trim().min(1),
  activate: z.boolean().default(true),
  agentJobId: z.string().trim().min(1).optional(),
});

export const queryAnalysisTickerSchema = z.object({
  id: z.string().uuid(),
  symbol: z.string(),
  name: z.string(),
  metadata: z.unknown().nullable(),
  sector: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  subSector: z.string().nullable().optional(),
  subIndustry: z.string().nullable().optional(),
  businessActivity: z.string().nullable().optional(),
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

export const queryAnalysisPeerSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  relevance: z.number(),
});

export const queryAnalysisCalendarSchema = z.object({
  nextEarningsAt: z.string().datetime().optional(),
  recentEventTypes: z.array(z.string()),
});

export const queryAnalysisHeadlineSampleSchema = z.object({
  title: z.string(),
  publishedAt: z.string(),
  sourceName: z.string(),
});

export const queryAnalysisKgNeighborhoodSchema = z.object({
  fromEntity: z.string(),
  relationType: z.string(),
  toEntity: z.string(),
});

export const getQueryAnalysisResponseSchema = z.object({
  ticker: queryAnalysisTickerSchema,
  topEntities: z.array(queryAnalysisTopEntitySchema),
  recentThemes: z.array(queryAnalysisRecentThemeSchema),
  recentRelationDeltas: z.array(queryAnalysisRelationDeltaSchema).optional(),
  configSnapshot: queryAnalysisConfigSnapshotSchema.optional(),
  peers: z.array(queryAnalysisPeerSchema).default([]),
  calendar: queryAnalysisCalendarSchema.default({ recentEventTypes: [] }),
  headlineSamples: z.array(queryAnalysisHeadlineSampleSchema).default([]),
  kgNeighborhood: z.array(queryAnalysisKgNeighborhoodSchema).default([]),
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
export type QueryAnalysisIntentWeights = Record<QueryAnalysisIntent, number>;
