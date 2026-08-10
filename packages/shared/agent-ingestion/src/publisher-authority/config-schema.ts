import { PUBLISHER_AUTHORITY_DEFAULT_TTL_DAYS } from "@workspace/agent-data-api-contract";
import { z } from "zod";

export const publisherAuthoritySchema = z
  .object({
    apiKey: z
      .string()
      .default("{{OPEN_PAGE_RANK_API_KEY}}")
      .describe(
        "OpenPageRank API key. Leave blank to disable publisher-authority enrichment; collection is unaffected either way.",
      ),
    ttlDays: z
      .number()
      .int()
      .positive()
      .default(PUBLISHER_AUTHORITY_DEFAULT_TTL_DAYS)
      .describe(
        "Days a cached publisher authority stays fresh. OpenPageRank refreshes monthly, so a shorter window spends quota re-fetching identical numbers.",
      ),
  })
  .default({})
  .describe(
    "Publisher authority cache. Breaks ties between articles of equal section fit and never decides inclusion.",
  );

export type PublisherAuthorityConfig = z.infer<typeof publisherAuthoritySchema>;
