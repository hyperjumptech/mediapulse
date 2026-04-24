import { z } from "zod";

/** Zod schema for OpenAI LLM newsletter JSON output. */
export const newsletterStructureSchema = z.object({
  subject: z.string().optional(),
  executiveSummary: z.string().optional(),
  topNews: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string(),
      }),
    )
    .optional(),
});

/**
 * Parses and validates raw JSON string from OpenAI into newsletter structure.
 *
 * Lenient rule: accepts ≤ `topNewsCount` items in `topNews`. If the LLM returns
 * more, the response is rejected with an error.
 *
 * @param raw - Raw JSON string from LLM response.
 * @param topNewsCount - Maximum number of topNews items allowed (defaults to 3).
 * @returns Validated newsletter structure.
 * @throws Error when JSON is invalid, structure does not match schema, or
 *   topNews exceeds topNewsCount.
 */
export function parseNewsletterJson(
  raw: string,
  topNewsCount: number = 3,
): z.infer<typeof newsletterStructureSchema> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI returned invalid JSON");
  }
  const result = newsletterStructureSchema.parse(parsed);
  if (Array.isArray(result.topNews) && result.topNews.length > topNewsCount) {
    throw new Error(
      `Expected at most ${topNewsCount} topNews items, got ${result.topNews.length}`,
    );
  }
  return result;
}
