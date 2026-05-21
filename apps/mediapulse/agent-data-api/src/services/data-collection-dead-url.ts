import type { Prisma } from "@mediapulse/database";
import {
  computeDeadUrlExpiresAt,
  isDeadUrlCacheable,
  type DeadUrlRecordInput,
} from "@workspace/agent-data-api-contract";

type DeadUrlDb = Pick<
  typeof import("@mediapulse/database").prisma.deadUrl,
  "findMany" | "upsert"
>;

export type RecordDeadUrlDeps = {
  deadUrl: DeadUrlDb;
  now?: Date;
};

/**
 * Returns URLs from the request that are still cached as dead for the ticker.
 *
 * @param tickerId - Ticker id to scope the lookup.
 * @param urls - Candidate URLs to check.
 * @param deadUrl - Prisma delegate for `deadUrl`.
 * @param now - Reference time for expiry filtering.
 */
export async function lookupDeadUrls(
  tickerId: string,
  urls: readonly string[],
  deadUrl: DeadUrlDb,
  now: Date = new Date(),
): Promise<string[]> {
  const uniqueRequested = [...new Set(urls)];

  if (uniqueRequested.length === 0) {
    return [];
  }

  const findArgs = {
    where: {
      tickerId,
      url: { in: uniqueRequested },
      expiresAt: { gt: now },
    },
    select: { url: true },
  } satisfies Prisma.DeadUrlFindManyArgs;

  const rows = await deadUrl.findMany(findArgs);
  return [...new Set(rows.map((row) => row.url))];
}

/**
 * Persists or refreshes cacheable dead URLs; skips ineligible categories and HTTP statuses.
 *
 * @param records - Dead URL entries from the agent.
 * @param deps - Database delegate and optional clock.
 */
export async function recordDeadUrls(
  records: readonly DeadUrlRecordInput[],
  deps: RecordDeadUrlDeps,
): Promise<number> {
  const { deadUrl } = deps;
  const now = deps.now ?? new Date();
  let recordedCount = 0;

  for (const record of records) {
    if (!isDeadUrlCacheable(record.errorCategory, record.httpStatus)) {
      continue;
    }

    const cacheableCategory = record.errorCategory;
    const expiresAt = computeDeadUrlExpiresAt(
      cacheableCategory,
      record.httpStatus,
      now,
    );

    const upsertArgs = {
      where: { url: record.url },
      create: {
        tickerId: record.tickerId,
        url: record.url,
        errorCategory: cacheableCategory,
        recordedAt: now,
        expiresAt,
      },
      update: {
        tickerId: record.tickerId,
        errorCategory: cacheableCategory,
        expiresAt,
      },
    } satisfies Prisma.DeadUrlUpsertArgs;

    await deadUrl.upsert(upsertArgs);
    recordedCount += 1;
  }

  return recordedCount;
}
