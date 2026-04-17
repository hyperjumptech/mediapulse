import { z } from "zod";

const sentimentSchema = z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL"]);
const relevanceBreakdownSchema = z
  .object({
    _version: z.number().int().min(1),
    breakingNews: z.number().min(0).max(1),
    kgRelation: z.number().min(0).max(1),
    fundamental: z.number().min(0).max(1),
    tickerSalience: z.number().min(0).max(1),
    sourceQuality: z.number().min(0).max(1),
  })
  .passthrough();

export const getAnalysisQuerySchema = z
  .object({
    tickerId: z.string().trim().min(1),
    /** Omitted query param defaults to incremental unanalyzed-only runs (PRD FR2). */
    unanalyzed: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    /** Inclusive lower bound on `DataSource.createdAt` (ISO 8601), FR1 eligibility window. */
    start: z.preprocess(
      (v) => (v === "" || v === undefined ? undefined : v),
      z.string().datetime().optional(),
    ),
    /** Inclusive upper bound on `DataSource.createdAt` (ISO 8601), FR1 eligibility window. */
    end: z.preprocess(
      (v) => (v === "" || v === undefined ? undefined : v),
      z.string().datetime().optional(),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.start !== undefined && data.end !== undefined) {
      const startMs = new Date(data.start).getTime();
      const endMs = new Date(data.end).getTime();
      if (startMs > endMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "start must be before or equal to end",
          path: ["start"],
        });
      }
    }
  });

export const postAnalysisBodySchema = z.object({
  tickerId: z.string().trim().min(1),
  entities: z
    .array(
      z.object({
        canonicalName: z.string().trim().min(1),
        typeId: z.string().uuid(),
        description: z.string().optional(),
        aliases: z.array(z.string().trim().min(1)).default([]),
      }),
    )
    .default([]),
  relations: z
    .array(
      z.object({
        fromEntityName: z.string().trim().min(1),
        toEntityName: z.string().trim().min(1),
        relationTypeId: z.string().uuid(),
      }),
    )
    .default([]),
  articleEntities: z
    .array(
      z.object({
        dataSourceId: z.string().uuid(),
        entityName: z.string().trim().min(1),
        mentionCount: z.number().int().positive(),
        confidence: z.number().min(0).max(1),
        sentiment: sentimentSchema.optional(),
      }),
    )
    .default([]),
  articleRelevances: z
    .array(
      z.object({
        dataSourceId: z.string().uuid(),
        score: z.number().min(0).max(1),
        scoreBreakdown: relevanceBreakdownSchema,
        selected: z.boolean(),
      }),
    )
    .default([]),
});

export const analysisDataSourceSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  title: z.string(),
  content: z.string(),
  tickerId: z.string().trim().min(1),
  createdAt: z.coerce.date(),
});

export const analysisEntityTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
});

export const analysisRelationTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
});

export const analysisExistingEntitySchema = z.object({
  id: z.string().uuid(),
  canonicalName: z.string(),
  typeId: z.string().uuid(),
  aliases: z.array(z.string()),
});

/** UTC-day selection budget for article relevance (see article-analysis agent). */
export const analysisRelevanceSelectionStateSchema = z.object({
  /** ISO 8601 instant for UTC midnight at the start of the scoring "today". */
  utcDayStartIso: z.string(),
  /** Count of `articleRelevance` rows with `selected: true` and `scoredAt` on or after `utcDayStartIso`. */
  selectedCountToday: z.number().int().nonnegative(),
});

export const getAnalysisResponseSchema = z.object({
  dataSources: z.array(analysisDataSourceSchema),
  entityTypes: z.array(analysisEntityTypeSchema),
  relationTypes: z.array(analysisRelationTypeSchema),
  existingEntities: z.array(analysisExistingEntitySchema),
  relevanceSelectionState: analysisRelevanceSelectionStateSchema,
});

export const postAnalysisResponseSchema = z.object({
  entitiesCreated: z.number().int().nonnegative(),
  entitiesReused: z.number().int().nonnegative(),
  relationsCreated: z.number().int().nonnegative(),
  articlesScored: z.number().int().nonnegative(),
  articlesSelected: z.number().int().nonnegative(),
});

export type GetAnalysisQuery = z.infer<typeof getAnalysisQuerySchema>;
export type PostAnalysisBody = z.infer<typeof postAnalysisBodySchema>;
export type GetAnalysisResponse = z.infer<typeof getAnalysisResponseSchema>;
export type PostAnalysisResponse = z.infer<typeof postAnalysisResponseSchema>;
