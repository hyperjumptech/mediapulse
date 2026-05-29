import { z } from "zod";

/** Serper `tbs` presets exposed in Hermes config. */
export const serperDateRangeSchema = z.enum([
  "past_hour",
  "past_day",
  "past_week",
  "past_month",
  "past_year",
  "all",
]);

export type SerperDateRange = z.infer<typeof serperDateRangeSchema>;

/** Serper search mode — `news` uses the `/news` endpoint. */
export const serperSearchTypeSchema = z.enum(["search", "news"]);

export type SerperSearchType = z.infer<typeof serperSearchTypeSchema>;

/** Hermes-configurable Serper query parameters (see https://serper.dev). */
export const serperQueryConfigSchema = z.object({
  country: z
    .string()
    .default("id")
    .describe("Serper `gl` country code (default Indonesia)."),
  language: z
    .union([z.literal("auto"), z.string().min(2)])
    .default("auto")
    .describe('Serper `hl` language code, or "auto" to omit the parameter.'),
  dateRange: serperDateRangeSchema
    .default("past_week")
    .describe("Serper `tbs` time filter (default past week)."),
  type: serperSearchTypeSchema
    .default("news")
    .describe("Serper search type. News uses the /news endpoint."),
  num: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe("Optional number of Serper results per query."),
  location: z
    .string()
    .optional()
    .describe("Optional Serper location for localized results."),
});

export type SerperQueryConfig = z.infer<typeof serperQueryConfigSchema>;

const SERPER_DATE_RANGE_TO_TBS: Record<SerperDateRange, string | undefined> = {
  past_hour: "qdr:h",
  past_day: "qdr:d",
  past_week: "qdr:w",
  past_month: "qdr:m",
  past_year: "qdr:y",
  all: undefined,
};

/**
 * Maps a configured date-range preset to Serper's `tbs` query parameter.
 *
 * @param dateRange - Hermes date-range preset.
 * @returns Serper `tbs` value, or `undefined` when no time filter applies.
 */
export const serperDateRangeToTbs = (
  dateRange: SerperDateRange,
): string | undefined => SERPER_DATE_RANGE_TO_TBS[dateRange];

/**
 * Resolves the Serper POST URL from the configured base URL and search type.
 *
 * @param baseUrl - Provider base URL from Hermes config.
 * @param type - Serper search type (`search` or `news`).
 */
export const resolveSerperEndpoint = (
  baseUrl: string,
  type: SerperSearchType,
): string => {
  const url = new URL(baseUrl);
  url.pathname = type === "news" ? "/news" : "/search";
  return url.href.replace(/\/$/, "");
};

/**
 * Builds the JSON body for a Serper search or news request.
 *
 * @param queryText - Search query string from the Agent Data API.
 * @param queryConfig - Serper query settings from Hermes config.
 */
export const buildSerperRequestBody = (
  queryText: string,
  queryConfig: SerperQueryConfig,
): Record<string, string | number> => {
  const body: Record<string, string | number> = {
    q: queryText,
    gl: queryConfig.country,
  };

  if (queryConfig.language !== "auto") {
    body.hl = queryConfig.language;
  }

  if (queryConfig.type === "news") {
    body.type = "news";
  }

  const tbs = serperDateRangeToTbs(queryConfig.dateRange);
  if (tbs) {
    body.tbs = tbs;
  }

  if (queryConfig.num !== undefined) {
    body.num = queryConfig.num;
  }

  if (queryConfig.location) {
    body.location = queryConfig.location;
  }

  return body;
};
