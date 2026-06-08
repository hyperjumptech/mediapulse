import type { Prisma } from "@mediapulse/database";
import type { ListingDiscoveryCacheRecordInput } from "@workspace/agent-data-api-contract";

type ListingDiscoveryCacheDb = Pick<
  typeof import("@mediapulse/database").prisma.listingDiscoveryCache,
  "findMany" | "upsert"
>;

export type LookupListingDiscoveryCacheDeps = {
  listingDiscoveryCache: ListingDiscoveryCacheDb;
  now?: Date;
};

export type RecordListingDiscoveryCacheDeps = {
  listingDiscoveryCache: ListingDiscoveryCacheDb;
  now?: Date;
};

/**
 * Returns cached discovery entries for the requested listing URLs where `expiresAt > now`.
 *
 * @param listingUrls - URLs to look up in the cache.
 * @param deps - Database delegate and optional clock.
 */
export async function lookupListingDiscoveryCache(
  listingUrls: readonly string[],
  deps: LookupListingDiscoveryCacheDeps,
): Promise<Array<{ listingUrl: string; items: unknown[] }>> {
  const { listingDiscoveryCache } = deps;
  const now = deps.now ?? new Date();

  if (listingUrls.length === 0) {
    return [];
  }

  const findArgs = {
    where: {
      listingUrl: { in: [...listingUrls] },
      expiresAt: { gt: now },
    },
    select: {
      listingUrl: true,
      items: true,
    },
  } satisfies Prisma.ListingDiscoveryCacheFindManyArgs;

  const rows = await listingDiscoveryCache.findMany(findArgs);
  return rows.map((row) => ({
    listingUrl: row.listingUrl,
    items: row.items as unknown[],
  }));
}

/**
 * Upserts fresh discovery results, refreshing the `expiresAt` based on the given TTL.
 *
 * @param records - Discovery results to cache.
 * @param deps - Database delegate and optional clock.
 * @returns Number of rows upserted.
 */
export async function recordListingDiscoveryCache(
  records: readonly ListingDiscoveryCacheRecordInput[],
  deps: RecordListingDiscoveryCacheDeps,
): Promise<number> {
  const { listingDiscoveryCache } = deps;
  const now = deps.now ?? new Date();
  let recorded = 0;

  for (const record of records) {
    const expiresAt = new Date(now.getTime() + record.ttlSeconds * 1000);

    const upsertArgs = {
      where: { listingUrl: record.listingUrl },
      create: {
        listingUrl: record.listingUrl,
        strategy: record.strategy,
        items: record.items,
        fetchedAt: now,
        expiresAt,
      },
      update: {
        strategy: record.strategy,
        items: record.items,
        fetchedAt: now,
        expiresAt,
      },
    } satisfies Prisma.ListingDiscoveryCacheUpsertArgs;

    await listingDiscoveryCache.upsert(upsertArgs);
    recorded += 1;
  }

  return recorded;
}
