import type { Prisma } from "@mediapulse/database";
import { prisma } from "@mediapulse/database";

/**
 * Aggregates stored data-source URLs for one ticker into hostname counts.
 *
 * @param tickerId - Ticker whose corpus is scanned for host fatigue.
 * @returns Map of lowercase hostname to source count.
 */
export const getDataSourceHostCountsForTicker = async (
  tickerId: string,
): Promise<Record<string, number>> => {
  const findArgs = {
    where: { tickerId },
    select: { url: true },
  } satisfies Prisma.DataSourceFindManyArgs;

  const rows = await prisma.dataSource.findMany(findArgs);
  const hostCounts: Record<string, number> = {};

  for (const row of rows) {
    try {
      const host = new URL(row.url).hostname.toLowerCase();
      hostCounts[host] = (hostCounts[host] ?? 0) + 1;
    } catch {
      // Skip malformed URLs rather than failing the lookup.
    }
  }

  return hostCounts;
};
