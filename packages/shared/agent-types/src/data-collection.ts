import { z } from "zod";

/**
 * Shape for incoming data-collection GET query params.
 */
export const dataCollectionQuerySchema = z.object({
  tickerId: z.string().uuid(),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
});

export type DataCollectionQuery = z.infer<typeof dataCollectionQuerySchema>;

/**
 * Shape for creating a data-collection record (POST body from data-collection agent).
 */
export const dataCollectionInputSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  description: z.string().optional(),
  content: z.string().optional(),
  author: z.string().optional(),
  source: z.string().optional(),
  tickerId: z.string().uuid(),
  searchQueryId: z.string().uuid(),
  dataCollectionRunId: z.string().uuid().optional(),
  publishedAt: z.string().datetime().optional(),
  metadata: z.object({ provider: z.string().optional() }).optional(),
});

export type DataCollectionInput = z.infer<typeof dataCollectionInputSchema>;

/**
 * Shape for the full data-collection POST body: an array of inputs.
 */
export const dataCollectionBodySchema = z.array(dataCollectionInputSchema);

export type DataCollectionBody = z.infer<typeof dataCollectionBodySchema>;
