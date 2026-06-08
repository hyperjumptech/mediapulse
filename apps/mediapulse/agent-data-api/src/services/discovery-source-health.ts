import type { Prisma } from "@mediapulse/database";
import type {
  DiscoverySourceHealthRecordInput,
  PostDiscoverySourceHealthGetBody,
  PostDiscoverySourceHealthGetResponse,
} from "@workspace/agent-data-api-contract";

const toUtcRunDate = (date: Date): Date =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

const utcDayStart = (date: Date): Date =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

type DiscoverySourceHealthDb = Pick<
  typeof import("@mediapulse/database").prisma.discoverySourceHealth,
  "upsert" | "findMany"
>;

export type RecordDiscoverySourceHealthDeps = {
  discoverySourceHealth: DiscoverySourceHealthDb;
  now?: Date;
};

export type GetDiscoverySourceHealthDeps = {
  discoverySourceHealth: DiscoverySourceHealthDb;
  now?: Date;
};

/**
 * Upserts per-source daily health rows keyed by `(listingUrl, runDate)`.
 *
 * @param records - Health rows to upsert.
 * @param deps - Database delegate and optional clock.
 * @returns Number of rows upserted.
 */
export async function recordDiscoverySourceHealth(
  records: readonly DiscoverySourceHealthRecordInput[],
  deps: RecordDiscoverySourceHealthDeps,
): Promise<number> {
  const { discoverySourceHealth } = deps;
  const now = deps.now ?? new Date();
  let recorded = 0;

  for (const record of records) {
    const normalizedRunDate = toUtcRunDate(new Date(record.runDate));

    const upsertArgs = {
      where: {
        listingUrl_runDate: {
          listingUrl: record.listingUrl,
          runDate: normalizedRunDate,
        },
      },
      create: {
        listingUrl: record.listingUrl,
        runDate: normalizedRunDate,
        discovered: record.discovered,
        itemCount: record.itemCount,
        winningStrategy: record.winningStrategy ?? null,
        failureCount: record.failureCount,
        lastError: record.lastError ?? null,
      },
      update: {
        discovered: record.discovered,
        itemCount: record.itemCount,
        winningStrategy: record.winningStrategy ?? null,
        failureCount: record.failureCount,
        lastError: record.lastError ?? null,
        computedAt: now,
      },
    } satisfies Prisma.DiscoverySourceHealthUpsertArgs;

    await discoverySourceHealth.upsert(upsertArgs);
    recorded += 1;
  }

  return recorded;
}

/**
 * Returns per-source health entries with derived failure signals for the given window.
 *
 * @param body - Listing URLs and lookback window in days.
 * @param deps - Database delegate and optional clock.
 * @returns Array of health entries with computed `consecutiveFailedRuns`, `lastSuccessfulAt`, `failureRate`.
 */
export async function getDiscoverySourceHealth(
  body: PostDiscoverySourceHealthGetBody,
  deps: GetDiscoverySourceHealthDeps,
): Promise<PostDiscoverySourceHealthGetResponse> {
  const { listingUrls, windowDays } = body;
  const now = deps.now ?? new Date();
  const windowStartMs = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  const windowStart = toUtcRunDate(new Date(windowStartMs));

  if (listingUrls.length === 0) {
    return [];
  }

  const rows = await deps.discoverySourceHealth.findMany({
    where: {
      listingUrl: { in: listingUrls },
      runDate: { gte: windowStart },
    },
    orderBy: [{ listingUrl: "asc" }, { runDate: "desc" }],
  });

  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const group = grouped.get(row.listingUrl);
    if (group) {
      group.push(row);
    } else {
      grouped.set(row.listingUrl, [row]);
    }
  }

  return listingUrls.map((listingUrl) => {
    const listingRows = grouped.get(listingUrl) ?? [];

    let consecutiveFailedRuns = 0;
    for (const row of listingRows) {
      if (!row.discovered) {
        consecutiveFailedRuns += 1;
      } else {
        break;
      }
    }

    const lastSuccessfulRow = listingRows.find((row) => row.discovered);
    const lastSuccessfulAt = lastSuccessfulRow
      ? lastSuccessfulRow.computedAt.toISOString()
      : null;

    const failedCount = listingRows.filter((row) => !row.discovered).length;
    const failureRate =
      listingRows.length > 0 ? failedCount / listingRows.length : 0;

    return {
      listingUrl,
      rows: listingRows.map((row) => ({
        listingUrl: row.listingUrl,
        runDate: utcDayStart(row.runDate).toISOString(),
        discovered: row.discovered,
        itemCount: row.itemCount,
        winningStrategy: row.winningStrategy,
        failureCount: row.failureCount,
        lastError: row.lastError,
        computedAt: row.computedAt.toISOString(),
      })),
      consecutiveFailedRuns,
      lastSuccessfulAt,
      failureRate,
    };
  });
}
