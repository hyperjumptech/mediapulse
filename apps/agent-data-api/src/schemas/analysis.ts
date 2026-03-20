import { z } from "zod";

const sentimentSchema = z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL"]);

export const getAnalysisQuerySchema = z.object({
  tickerId: z.string().uuid(),
  unanalyzed: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export const postAnalysisBodySchema = z.object({
  tickerId: z.string().uuid(),
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
        scoreBreakdown: z.record(z.string(), z.number()),
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
  tickerId: z.string().uuid(),
  createdAt: z.date(),
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

export const getAnalysisResponseSchema = z.object({
  dataSources: z.array(analysisDataSourceSchema),
  entityTypes: z.array(analysisEntityTypeSchema),
  relationTypes: z.array(analysisRelationTypeSchema),
  existingEntities: z.array(analysisExistingEntitySchema),
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
