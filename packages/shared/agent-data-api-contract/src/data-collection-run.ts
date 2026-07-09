import { z } from "zod";

import { collectionRunSnapshotSchema } from "./collection-run-snapshot.js";

export const dataCollectionRunStatusSchema = z.enum([
  "success",
  "partial_success",
  "failed",
]);

export const dataCollectionRunInputSchema = z.object({
  id: z.string().uuid(),
  tickerId: z.string().trim().min(1).optional(),
  scheduleExecutionId: z.string().uuid().optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  status: dataCollectionRunStatusSchema,
  counters: z.object({
    queriesTotal: z.number().int().nonnegative(),
    urlsTotal: z.number().int().nonnegative(),
    searchSuccess: z.number().int().nonnegative(),
    searchFailed: z.number().int().nonnegative(),
    fetchSuccess: z.number().int().nonnegative(),
    fetchFailed: z.number().int().nonnegative(),
    retryCount: z.number().int().nonnegative(),
    droppedByRelevance: z.number().int().nonnegative(),
    throttleEvents: z.number().int().nonnegative(),
    // Extended optional counters for detailed insights
    discovered: z.number().int().nonnegative().optional(),
    afterPrefilter: z.number().int().nonnegative().optional(),
    discoveryFailed: z.number().int().nonnegative().optional(),
    cacheHits: z.number().int().nonnegative().optional(),
    cacheMisses: z.number().int().nonnegative().optional(),
    droppedByContentQuality: z
      .record(z.string(), z.number().int().nonnegative())
      .optional(),
    droppedByFreshness: z.number().int().nonnegative().optional(),
    droppedByDeadUrl: z.number().int().nonnegative().optional(),
    droppedByHostErrorRate: z.number().int().nonnegative().optional(),
    droppedByFetchBudget: z.number().int().nonnegative().optional(),
    droppedByRunItemCap: z.number().int().nonnegative().optional(),
    droppedByExistingCanonicalUrl: z.number().int().nonnegative().optional(),
    droppedByDuplicateCanonicalUrl: z.number().int().nonnegative().optional(),
    droppedByUrlNoise: z.number().int().nonnegative().optional(),
    persisted: z.number().int().nonnegative().optional(),
    deadlineHit: z.boolean().optional(),
    durationMs: z.number().int().nonnegative().optional(),
    agentId: z.string().optional(),
    roundsExecuted: z.number().int().nonnegative().optional(),
    stopReason: z.string().optional(),
    // Chronicle instrumentation: durable provider usage + relevance-LLM token record.
    // These flow into the `extendedCounters` JSON column (no schema migration).
    /** Search-provider name (e.g. "serper"). */
    searchProvider: z.string().optional(),
    /** Total search credits consumed by the provider across the run. */
    searchCredits: z.number().int().nonnegative().optional(),
    /** Fetch-provider request counts keyed by provider (e.g. { jina: 204, playwright: 18 }). */
    fetchByProvider: z
      .record(z.string(), z.number().int().nonnegative())
      .optional(),
    /** Relevance-filter LLM model id. */
    relevanceModel: z.string().optional(),
    /** Relevance-filter LLM prompt tokens summed across the run. */
    relevancePromptTokens: z.number().int().nonnegative().optional(),
    /** Relevance-filter LLM completion tokens summed across the run. */
    relevanceCompletionTokens: z.number().int().nonnegative().optional(),
    /** Relevance-filter LLM total tokens summed across the run. */
    relevanceTotalTokens: z.number().int().nonnegative().optional(),
  }),
  snapshot: collectionRunSnapshotSchema.optional(),
});

export const postDataCollectionRunBodySchema = dataCollectionRunInputSchema;

export const postDataCollectionRunResponseSchema = z.object({
  message: z.string(),
});

export const getDataCollectionRunResponseSchema = z.object({
  data: z.array(dataCollectionRunInputSchema),
});

export const dataCollectionRunQuerySchema = z.object({
  tickerId: z.string().trim().min(1).optional(),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
});

export type DataCollectionRunBody = z.infer<
  typeof postDataCollectionRunBodySchema
>;
export type PostDataCollectionRunResponse = z.infer<
  typeof postDataCollectionRunResponseSchema
>;
export type GetDataCollectionRunResponse = z.infer<
  typeof getDataCollectionRunResponseSchema
>;
export type DataCollectionRunQuery = z.infer<
  typeof dataCollectionRunQuerySchema
>;
export type DataCollectionRun = z.infer<typeof dataCollectionRunInputSchema>;
