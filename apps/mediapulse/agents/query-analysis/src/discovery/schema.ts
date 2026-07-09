import { z } from "zod";

/** A single discovered competitor or regulator with alias and keyword hints. */
export const discoveredEntitySchema = z.object({
  name: z.string(),
  aliases: z.array(z.string()),
  searchKeywords: z.array(z.string()),
});

/** The full discovery result: competitors, regulators, and input/demand context for one ticker. */
export const discoveryResultSchema = z.object({
  competitors: z.array(discoveredEntitySchema),
  regulators: z.array(discoveredEntitySchema),
  mainInputs: z.array(z.string()),
  customerSegments: z.array(z.string()),
});

/** Lenient variant used only to salvage a partial/loose object from raw model output. */
export const lenientDiscoveryResultSchema = z.object({
  competitors: z
    .array(
      z.object({
        name: z.string(),
        aliases: z.array(z.string()).default([]),
        searchKeywords: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  regulators: z
    .array(
      z.object({
        name: z.string(),
        aliases: z.array(z.string()).default([]),
        searchKeywords: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  mainInputs: z.array(z.string()).default([]),
  customerSegments: z.array(z.string()).default([]),
});

export type DiscoveredEntity = z.infer<typeof discoveredEntitySchema>;
export type DiscoveryResult = z.infer<typeof discoveryResultSchema>;
