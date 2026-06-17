import { z } from "zod";

/** Validates page-collection run input: curated source URLs to harvest. */
export const BodySchema = z.object({
  sourceUrls: z.array(z.string().url()).min(1),
});

export type BodySchemaType = z.infer<typeof BodySchema>;
