import { z } from "zod";

/**
 * Returns true when `value` is an absolute URL with an `http:` or `https:` scheme.
 *
 * Used instead of `z.string().url()` so the JSON Schema sent to OpenAI structured
 * outputs does not use `format: "uri"`, which the Responses API rejects
 * (`invalid_json_schema`).
 *
 * @param value - Candidate URL string from structured output.
 * @returns Whether the value parses as an http(s) URL.
 */
const isHttpOrHttpsUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Citation object for structured output. `label` is a required string (use `""` when
 * absent) because OpenAI `json_schema` with `strict: true` requires `required` to list
 * every key in `properties`; optional Zod fields omit `label` from `required` and the
 * API rejects the schema. Empty/whitespace labels are stripped on output.
 */
const newsletterCitationSchema = z
  .object({
    url: z.string().min(1).refine(isHttpOrHttpsUrl, { message: "Invalid URL" }),
    label: z.string(),
  })
  .transform(({ url, label }) =>
    label.trim() === "" ? { url } : { url, label: label.trim() },
  );

/** Zod schema for OpenAI LLM newsletter JSON output. */
export const newsletterStructureSchema = z.object({
  subject: z.string(),
  executiveSummary: z.string(),
  topNews: z.array(
    z.object({
      title: z.string(),
      summaryWithLinks: z.string(),
      citations: z.array(newsletterCitationSchema).min(1),
    }),
  ),
});

/**
 * Fills missing `label` on each citation with `""` so legacy JSON without `label`
 * still parses after OpenAI strict-schema alignment.
 *
 * @param parsed - Unknown value from `JSON.parse` of newsletter JSON.
 * @returns Same structure with string `label` on every citation object.
 */
const ensureCitationLabelKeys = (parsed: unknown): unknown => {
  if (!parsed || typeof parsed !== "object") {
    return parsed;
  }
  const root = parsed as Record<string, unknown>;
  const topNews = root.topNews;
  if (!Array.isArray(topNews)) {
    return parsed;
  }
  return {
    ...root,
    topNews: topNews.map((item) => {
      if (!item || typeof item !== "object") {
        return item;
      }
      const row = item as Record<string, unknown>;
      const citations = row.citations;
      if (!Array.isArray(citations)) {
        return item;
      }
      return {
        ...row,
        citations: citations.map((citation) => {
          if (!citation || typeof citation !== "object") {
            return citation;
          }
          const c = citation as Record<string, unknown>;
          return {
            ...c,
            label: typeof c.label === "string" ? c.label : "",
          };
        }),
      };
    }),
  };
};

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
  const result = newsletterStructureSchema.parse(
    ensureCitationLabelKeys(parsed),
  );
  if (Array.isArray(result.topNews) && result.topNews.length > topNewsCount) {
    throw new Error(
      `Expected at most ${topNewsCount} topNews items, got ${result.topNews.length}`,
    );
  }
  return result;
}
