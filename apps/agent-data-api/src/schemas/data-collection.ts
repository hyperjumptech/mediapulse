import { z } from "zod";

export const getDataCollectionQuerySchema = z.object({
  tickerId: z.string().uuid(),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
});

export const postDataCollectionBodySchema = z.array(
  z.object({
    url: z.string().url(),
    title: z.string(),
    content: z.string(),
    tickerId: z.string().uuid(),
    searchQueryId: z.string().uuid(),
  }),
);

export type GetDataCollectionQuery = z.infer<
  typeof getDataCollectionQuerySchema
>;
export type PostDataCollectionBody = z.infer<
  typeof postDataCollectionBodySchema
>;
