import { z } from "zod";

/** Upper bound on Data Sources one ingestion request may claim. */
export const KNOWLEDGE_CANDIDATE_MAX_TAKE = 2000;

/** Upper bound on anchors one candidate lookup may carry. */
export const KNOWLEDGE_ANCHOR_LOOKUP_MAX = 200;

/**
 * Upper bound on Storylines returned for one anchor lookup.
 *
 * - Important: a common anchor such as a regulator's name matches many threads. Truncating keeps the
 *   agent's comparison bounded, and the precision guards then reject anything that should not match.
 */
export const KNOWLEDGE_CANDIDATE_STORYLINE_MAX = 50;

/** Ticker count beyond which a Storyline stops accepting automatic attachment. */
export const KNOWLEDGE_MAX_TICKERS = 5;

/** Development count beyond which a Storyline stops accepting automatic attachment. */
export const KNOWLEDGE_MAX_DEVELOPMENTS = 40;

/**
 * Why a Storyline should stop accepting automatic attachment, or null while it may keep growing.
 *
 * - Important: the server applies this on every write and the agent only counts the outcome, so a
 *   ceiling cannot drift between the two.
 *
 * @param tickerCount - Tickers currently linked to the Storyline.
 * @param developmentCount - Developments currently on it.
 */
export const knowledgeLockReason = (
  tickerCount: number,
  developmentCount: number,
): string | null => {
  if (tickerCount > KNOWLEDGE_MAX_TICKERS) {
    return `spans ${tickerCount} tickers, over the ceiling of ${KNOWLEDGE_MAX_TICKERS}`;
  }
  if (developmentCount > KNOWLEDGE_MAX_DEVELOPMENTS) {
    return `holds ${developmentCount} developments, over the ceiling of ${KNOWLEDGE_MAX_DEVELOPMENTS}`;
  }

  return null;
};

export const getKnowledgeCandidateSourcesQuerySchema = z.object({
  since: z.string().datetime().optional(),
  /**
   * Ignores the stored watermark and starts from the oldest Data Source.
   *
   * - Important: only for a deliberate rebuild. A scheduled run must leave this false, or it walks
   *   the same prefix of the corpus on every invocation and never advances.
   */
  fromStart: z.coerce.boolean().default(false),
  take: z.coerce
    .number()
    .int()
    .positive()
    .max(KNOWLEDGE_CANDIDATE_MAX_TAKE)
    .default(500),
});

const knowledgeCandidateSourceSchema = z.object({
  dataSourceId: z.string().min(1),
  title: z.string(),
  text: z.string(),
  observedAt: z.string(),
  publishedDay: z.string().nullable(),
  tickerIds: z.array(z.string().min(1)),
});

export const getKnowledgeCandidateSourcesResponseSchema = z.object({
  sources: z.array(knowledgeCandidateSourceSchema),
  /** Newest observation in this batch, to be stored as the next run's starting point. */
  watermark: z.string().nullable(),
  /** Where this batch actually started, whether from the caller, the stored watermark, or the beginning. */
  resumedFrom: z.string().nullable(),
});

export const postKnowledgeStorylineCandidatesBodySchema = z.object({
  anchors: z.array(z.string().min(1)).max(KNOWLEDGE_ANCHOR_LOOKUP_MAX),
});

const knowledgeDevelopmentSnapshotSchema = z.object({
  id: z.string().min(1),
  anchors: z.array(z.string()),
  titleAnchors: z.array(z.string()),
  figures: z.array(z.string()),
  day: z.string().nullable(),
});

const knowledgeStorylineSnapshotSchema = z.object({
  id: z.string().min(1),
  anchors: z.array(z.string()),
  tickerCount: z.number().int().nonnegative(),
  locked: z.boolean(),
  developments: z.array(knowledgeDevelopmentSnapshotSchema),
});

export const postKnowledgeStorylineCandidatesResponseSchema = z.object({
  storylines: z.array(knowledgeStorylineSnapshotSchema),
});

const knowledgeAttachEvidenceSchema = z.object({
  sharedAnchors: z.number().int().nonnegative(),
  containment: z.number(),
  storylineContainment: z.number(),
  path: z.enum(["body", "title"]),
});

/**
 * Outcome shared by every write. `locked` reports whether the ceiling closed the Storyline to
 * further automatic attachment, which the agent counts rather than deciding for itself.
 */
const knowledgeWriteResultSchema = z.object({
  storylineId: z.string().min(1),
  developmentId: z.string().min(1).nullable(),
  locked: z.boolean(),
  lockedReason: z.string().nullable(),
});

export const postKnowledgeStorylinesBodySchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  observedAt: z.string().datetime(),
  anchors: z.array(z.string().min(1)),
  titleAnchors: z.array(z.string().min(1)),
  figures: z.array(z.string()),
  dataSourceId: z.string().min(1),
  tickerIds: z.array(z.string().min(1)),
  ingestionRunId: z.string().min(1).nullable(),
});

export const postKnowledgeStorylinesResponseSchema = knowledgeWriteResultSchema;

export const postKnowledgeDevelopmentsBodySchema = z.object({
  storylineId: z.string().min(1),
  title: z.string().min(1),
  observedAt: z.string().datetime(),
  anchors: z.array(z.string().min(1)),
  titleAnchors: z.array(z.string().min(1)),
  figures: z.array(z.string()),
  dataSourceId: z.string().min(1),
  tickerIds: z.array(z.string().min(1)),
  ingestionRunId: z.string().min(1).nullable(),
  evidence: knowledgeAttachEvidenceSchema,
});

export const postKnowledgeDevelopmentsResponseSchema =
  knowledgeWriteResultSchema;

export const postKnowledgeDevelopmentCitationsBodySchema = z.object({
  storylineId: z.string().min(1),
  developmentId: z.string().min(1),
  dataSourceId: z.string().min(1),
  tickerIds: z.array(z.string().min(1)),
  observedAt: z.string().datetime(),
  anchors: z.array(z.string().min(1)),
});

export const postKnowledgeDevelopmentCitationsResponseSchema =
  knowledgeWriteResultSchema;

export const postKnowledgeIngestionRunsBodySchema = z.object({
  scheduleExecutionId: z.string().min(1).nullable(),
  agentVersion: z.string().min(1),
  startedAt: z.string().datetime(),
});

export const postKnowledgeIngestionRunsResponseSchema = z.object({
  ingestionRunId: z.string().min(1),
});

export const postKnowledgeIngestionRunsFinishBodySchema = z.object({
  ingestionRunId: z.string().min(1),
  status: z.enum(["success", "partial_success", "failed"]),
  completedAt: z.string().datetime(),
  watermarkAt: z.string().datetime().nullable(),
  considered: z.number().int().nonnegative(),
  storylinesOpened: z.number().int().nonnegative(),
  developmentsOpened: z.number().int().nonnegative(),
  citationsAdded: z.number().int().nonnegative(),
  storylinesLocked: z.number().int().nonnegative(),
  skippedNoAnchors: z.number().int().nonnegative(),
  stopReason: z.string().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
});

export const postKnowledgeIngestionRunsFinishResponseSchema = z.object({
  message: z.string(),
});

export type KnowledgeCandidateSource = z.infer<
  typeof knowledgeCandidateSourceSchema
>;
export type KnowledgeStorylineSnapshot = z.infer<
  typeof knowledgeStorylineSnapshotSchema
>;
export type KnowledgeDevelopmentSnapshot = z.infer<
  typeof knowledgeDevelopmentSnapshotSchema
>;
export type KnowledgeAttachEvidence = z.infer<
  typeof knowledgeAttachEvidenceSchema
>;
export type KnowledgeWriteResult = z.infer<typeof knowledgeWriteResultSchema>;
export type GetKnowledgeCandidateSourcesQuery = z.infer<
  typeof getKnowledgeCandidateSourcesQuerySchema
>;
export type GetKnowledgeCandidateSourcesResponse = z.infer<
  typeof getKnowledgeCandidateSourcesResponseSchema
>;
export type PostKnowledgeStorylineCandidatesBody = z.infer<
  typeof postKnowledgeStorylineCandidatesBodySchema
>;
export type PostKnowledgeStorylineCandidatesResponse = z.infer<
  typeof postKnowledgeStorylineCandidatesResponseSchema
>;
export type PostKnowledgeStorylinesBody = z.infer<
  typeof postKnowledgeStorylinesBodySchema
>;
export type PostKnowledgeDevelopmentsBody = z.infer<
  typeof postKnowledgeDevelopmentsBodySchema
>;
export type PostKnowledgeDevelopmentCitationsBody = z.infer<
  typeof postKnowledgeDevelopmentCitationsBodySchema
>;
export type PostKnowledgeIngestionRunsBody = z.infer<
  typeof postKnowledgeIngestionRunsBodySchema
>;
export type PostKnowledgeIngestionRunsResponse = z.infer<
  typeof postKnowledgeIngestionRunsResponseSchema
>;
export type PostKnowledgeIngestionRunsFinishBody = z.infer<
  typeof postKnowledgeIngestionRunsFinishBodySchema
>;
