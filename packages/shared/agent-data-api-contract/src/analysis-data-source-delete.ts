import { z } from "zod";

export const postAnalysisDataSourceDeleteBodySchema = z.object({
  tickerId: z.string().trim().min(1),
  dataSourceId: z.string().uuid(),
});

export const postAnalysisDataSourceDeleteResponseSchema = z.object({
  deleted: z.boolean(),
});

export type PostAnalysisDataSourceDeleteBody = z.infer<
  typeof postAnalysisDataSourceDeleteBodySchema
>;
export type PostAnalysisDataSourceDeleteResponse = z.infer<
  typeof postAnalysisDataSourceDeleteResponseSchema
>;
