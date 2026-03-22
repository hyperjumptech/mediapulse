import { z } from "zod";

export const dataCollectionQuerySchema = z.object({
  tickerId: z.string().uuid(),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
});

const dataCollectionInputSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  description: z.string().optional(),
  content: z.string(),
  tickerId: z.string().uuid(),
  searchQueryId: z.string().uuid(),
});

export const dataCollectionBodySchema = z.array(dataCollectionInputSchema);

export const getDataCollectionResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().uuid(),
      text: z.string(),
      tickerId: z.string().uuid(),
    }),
  ),
});

export const postDataCollectionResponseSchema = z.object({
  message: z.string(),
});

export type DataCollectionBody = z.infer<typeof dataCollectionBodySchema>;
export type DataCollectionQuery = z.infer<typeof dataCollectionQuerySchema>;
export type GetDataCollectionResponse = z.infer<
  typeof getDataCollectionResponseSchema
>;
export type PostDataCollectionResponse = z.infer<
  typeof postDataCollectionResponseSchema
>;
