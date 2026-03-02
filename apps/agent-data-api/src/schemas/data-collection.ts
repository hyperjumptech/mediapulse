import { z } from "zod";

import { dataSourceInputSchema } from "@workspace/agent-types";

export const getDataCollectionQuerySchema = z.object({
  tickerId: z.string().uuid(),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
});

export const postDataCollectionBodySchema = z.array(dataSourceInputSchema);

export type GetDataCollectionQuery = z.infer<
  typeof getDataCollectionQuerySchema
>;
export type PostDataCollectionBody = z.infer<
  typeof postDataCollectionBodySchema
>;
