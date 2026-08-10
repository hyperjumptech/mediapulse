import { publisherAuthoritySchema } from "@workspace/agent-ingestion";
import { z } from "zod";

const collectionSchema = z
  .object({
    maxDiscoveredItemsPerRun: z
      .number()
      .int()
      .positive()
      .default(500)
      .describe(
        "Cap on candidate URLs taken from discovery, applied before any filtering. Excess URLs are discarded and counted in the run summary.",
      ),
    perRunCandidateBudget: z
      .number()
      .int()
      .positive()
      .default(50)
      .describe(
        "Cap on candidate URLs entering the per-article filters, applied after duplicate, already-collected, and dead-URL filtering. Articles still drop out on missing description, freshness, and ticker relevance, so fewer than this are persisted.",
      ),
  })
  .default({})
  .describe("Per-run collection caps.");

/** Zod schema for agent config grouped for Hermes form sections. */
export const ConfigSchema = z.object({
  collection: collectionSchema,
  publisher_authority: publisherAuthoritySchema,
});

export type ConfigSchemaType = z.infer<typeof ConfigSchema>;
