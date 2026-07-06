import { z } from "zod";

/** A single discovered competitor or regulator with alias and keyword hints. */
export const discoveredEntitySchema = z.object({
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  searchKeywords: z.array(z.string()).min(1),
});

/** The full discovery result: competitors and regulators for one ticker. */
export const discoveryResultSchema = z.object({
  competitors: z.array(discoveredEntitySchema).default([]),
  regulators: z.array(discoveredEntitySchema).default([]),
});

export type DiscoveredEntity = z.infer<typeof discoveredEntitySchema>;
export type DiscoveryResult = z.infer<typeof discoveryResultSchema>;
