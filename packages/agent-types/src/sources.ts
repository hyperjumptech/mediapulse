import { z } from "zod";

/**
 * Optional metadata attached to a collected source (e.g. search query text, fetch time).
 * Agents can use this for ordering, filtering, or display.
 */
export const sourceMetadataSchema = z
  .object({
    searchQueryText: z.string().optional(),
    fetchedAt: z.string().datetime().optional(),
    sourceType: z.enum(["web", "rss", "api"]).optional(),
  })
  .passthrough();

export type SourceMetadata = z.infer<typeof sourceMetadataSchema>;

/**
 * Shape for creating a data source (POST body from data-collection agent).
 * All agents that collect sources should produce this shape.
 */
export const dataSourceInputSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  content: z.string(),
  tickerId: z.string().uuid(),
  searchQueryId: z.string().uuid(),
  metadata: sourceMetadataSchema.nullable().optional(),
});

export type DataSourceInput = z.infer<typeof dataSourceInputSchema>;

/**
 * Shape returned when reading sources (GET /api/sources, used by content-generation and other agents).
 * Aligns with stored DataSource plus optional metadata for downstream use.
 */
export const dataSourceRecordSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  title: z.string(),
  content: z.string(),
  metadata: z.unknown().nullable(),
  tickerId: z.string().uuid(),
  searchQueryId: z.string().uuid(),
});

export type DataSourceRecord = z.infer<typeof dataSourceRecordSchema>;
