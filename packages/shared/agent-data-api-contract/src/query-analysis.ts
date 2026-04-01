import { z } from "zod";

export const getQueryAnalysisQuerySchema = z.object({
  tickerId: z.string().trim().min(1),
});

/** Per-query row persisted with a versioned set (FR2–FR3). */
export const postQueryAnalysisQueryItemSchema = z.object({
  text: z.string().trim().min(1),
  source: z.enum(["deterministic", "llm"]),
  intent: z.enum(["breaking", "kg_change", "fundamental"]),
  rank: z.number().int().nonnegative(),
});

export const postQueryAnalysisBodySchema = z.object({
  tickerId: z.string().trim().min(1),
  queries: z.array(postQueryAnalysisQueryItemSchema),
  /** Immutable snapshot of config and inputs used for this run (stored on the set row). */
  strategySnapshot: z.record(z.string(), z.unknown()),
  /** Pipeline implementation id (e.g. hybrid_v1). */
  generationSource: z.string().trim().min(1),
  /** Hermes `AgentJobExecution.jobId` from `X-Job-Id` when scheduled; omit for local runs. */
  agentJobId: z.string().trim().min(1).optional().nullable(),
  /** When true, this set becomes the sole active set for the ticker (FR2). */
  activate: z.boolean().default(true),
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

/** Global query-analysis tuning surfaced to the agent (FR5); sourced from env in agent-data-api. */
export const queryAnalysisConfigSnapshotSchema = z.object({
  queryCount: z.number().int().positive(),
  allowedLanguages: z.array(z.string()),
  minDeterministicCount: z.number().int().nonnegative(),
  weightBreaking: z.number(),
  weightKgChange: z.number(),
  weightFundamental: z.number(),
  model: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
});

/** Phase 2 placeholder; always empty in v1. */
export const queryAnalysisRelationDeltaSchema = z.object({
  summary: z.string(),
});

export const getQueryAnalysisResponseSchema = z.object({
  ticker: queryAnalysisTickerSchema,
  topEntities: z.array(queryAnalysisTopEntitySchema),
  recentThemes: z.array(queryAnalysisRecentThemeSchema),
  configSnapshot: queryAnalysisConfigSnapshotSchema,
  relationDeltas: z.array(queryAnalysisRelationDeltaSchema),
});

export const postQueryAnalysisResponseSchema = z.object({
  created: z.number().int().nonnegative(),
  setId: z.string().uuid(),
  activeSetId: z.string().uuid(),
});

export type GetQueryAnalysisQuery = z.infer<typeof getQueryAnalysisQuerySchema>;
export type PostQueryAnalysisBody = z.infer<typeof postQueryAnalysisBodySchema>;
export type PostQueryAnalysisQueryItem = z.infer<
  typeof postQueryAnalysisQueryItemSchema
>;
export type GetQueryAnalysisResponse = z.infer<
  typeof getQueryAnalysisResponseSchema
>;
export type PostQueryAnalysisResponse = z.infer<
  typeof postQueryAnalysisResponseSchema
>;
export type QueryAnalysisConfigSnapshot = z.infer<
  typeof queryAnalysisConfigSnapshotSchema
>;
