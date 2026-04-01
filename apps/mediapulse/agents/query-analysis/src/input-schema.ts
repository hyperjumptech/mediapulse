import { z } from "zod";

/** Hermes / worker payload: which ticker to generate queries for. */
export const InputSchema = z.object({
  tickerId: z.string().min(1),
});

export type QueryAnalysisInput = z.infer<typeof InputSchema>;
