import { z } from "zod";

export const queryResponseSchema = z.object({
  queries: z
    .array(
      z.object({
        text: z.string().trim().min(1),
        angle: z.string().trim().min(1),
      }),
    )
    .min(1)
    .max(15),
});

export type ParsedQueryResponse = z.infer<typeof queryResponseSchema>;

/**
 * Parses and validates the OpenAI query-analysis response payload.
 *
 * @param raw - Raw JSON string from OpenAI.
 * @returns Validated query response object.
 */
export const parseQueryResponse = (raw: string): ParsedQueryResponse => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI returned invalid JSON for query-analysis");
  }

  return queryResponseSchema.parse(parsed);
};
