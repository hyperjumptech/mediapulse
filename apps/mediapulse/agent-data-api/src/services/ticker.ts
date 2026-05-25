import { prisma } from "@mediapulse/database";
import type { GetTickerResponse } from "@workspace/agent-data-api-contract";
import { z } from "zod";

import { extractTickerSectorIndustry } from "./query-analysis-context-helpers";

const tickerMetadataSchema = z
  .object({
    aliases: z.array(z.string()).optional(),
  })
  .passthrough();

/**
 * Loads one ticker row and normalizes alias metadata for agent consumers.
 *
 * @param tickerId - Primary key of the ticker row.
 * @returns Ticker identity payload, or `null` when the row is missing.
 */
export const getTickerForAgent = async (
  tickerId: string,
): Promise<GetTickerResponse | null> => {
  const row = await prisma.ticker.findUnique({
    where: { id: tickerId },
  });

  if (!row) {
    return null;
  }

  const metadata = tickerMetadataSchema.safeParse(row.metadata);
  const storedAliases =
    metadata.success && Array.isArray(metadata.data.aliases)
      ? metadata.data.aliases
      : [];

  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const alias of storedAliases) {
    const trimmed = alias.trim();
    const normalized = trimmed.toLowerCase();
    if (trimmed.length === 0 || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    aliases.push(trimmed);
  }

  const { sector, industry } = extractTickerSectorIndustry(row.metadata);

  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    aliases,
    sector: sector ?? null,
    industry: industry ?? null,
  };
};
