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
 * @param raw - Raw JSON string from LLM response.
 * @returns Validated newsletter structure.
 * @throws Error when JSON is invalid or structure does not match schema.
 */
export function parseNewsletterJson(
  raw: string,
): z.infer<typeof newsletterStructureSchema> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI returned invalid JSON");
  }
  return newsletterStructureSchema.parse(parsed);
}
