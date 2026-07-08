import type { Prisma } from "@mediapulse/database";
import type {
  PostTickerDiscoveryRecordBody,
  PostTickerDiscoveryRecordResponse,
  TickerDiscoveryEntry,
} from "@workspace/agent-data-api-contract";

type TickerDiscoveryDb = Pick<
  typeof import("@mediapulse/database").prisma.tickerDiscovery,
  "findFirst" | "upsert"
>;

export type LookupTickerDiscoveryDeps = {
  tickerDiscovery: TickerDiscoveryDb;
  now?: Date;
};

export type RecordTickerDiscoveryDeps = {
  tickerDiscovery: TickerDiscoveryDb;
  now?: Date;
};

/**
 * Returns the cached discovery entry for a ticker when it exists and `expiresAt > now`.
 *
 * @param params - Ticker whose cached discovery to fetch.
 * @param deps - Database delegate and optional clock.
 * @returns The cached entry, or `null` on a miss or when expired.
 */
export async function lookupTickerDiscovery(
  params: { tickerId: string },
  deps: LookupTickerDiscoveryDeps,
): Promise<TickerDiscoveryEntry | null> {
  const { tickerDiscovery } = deps;
  const now = deps.now ?? new Date();

  const findArgs = {
    where: {
      tickerId: params.tickerId,
      expiresAt: { gt: now },
    },
    select: {
      tickerId: true,
      competitors: true,
      regulators: true,
      mainInputs: true,
      customerSegments: true,
      model: true,
      contractVersion: true,
      expiresAt: true,
    },
  } satisfies Prisma.TickerDiscoveryFindFirstArgs;

  const row = await tickerDiscovery.findFirst(findArgs);
  if (row === null) {
    return null;
  }

  return {
    tickerId: row.tickerId,
    competitors: row.competitors as TickerDiscoveryEntry["competitors"],
    regulators: row.regulators as TickerDiscoveryEntry["regulators"],
    mainInputs: row.mainInputs as TickerDiscoveryEntry["mainInputs"],
    customerSegments:
      row.customerSegments as TickerDiscoveryEntry["customerSegments"],
    model: row.model,
    contractVersion: row.contractVersion,
    expiresAt: row.expiresAt.toISOString(),
  };
}

/**
 * Upserts fresh discovery results for a ticker, refreshing `expiresAt` from the given TTL.
 *
 * @param record - Discovery results to cache (competitors, regulators, audit model, TTL).
 * @param deps - Database delegate and optional clock.
 * @returns The upserted ticker id and its refreshed expiry.
 */
export async function recordTickerDiscovery(
  record: PostTickerDiscoveryRecordBody,
  deps: RecordTickerDiscoveryDeps,
): Promise<PostTickerDiscoveryRecordResponse> {
  const { tickerDiscovery } = deps;
  const now = deps.now ?? new Date();
  const expiresAt = new Date(now.getTime() + record.ttlSeconds * 1000);
  const competitors = record.competitors as unknown as Prisma.InputJsonValue;
  const regulators = record.regulators as unknown as Prisma.InputJsonValue;
  const mainInputs = record.mainInputs as unknown as Prisma.InputJsonValue;
  const customerSegments =
    record.customerSegments as unknown as Prisma.InputJsonValue;
  const model = record.model ?? null;
  const contractVersion = record.contractVersion ?? null;

  const upsertArgs = {
    where: { tickerId: record.tickerId },
    create: {
      tickerId: record.tickerId,
      competitors,
      regulators,
      mainInputs,
      customerSegments,
      model,
      contractVersion,
      expiresAt,
    },
    update: {
      competitors,
      regulators,
      mainInputs,
      customerSegments,
      model,
      contractVersion,
      expiresAt,
    },
    select: { tickerId: true, expiresAt: true },
  } satisfies Prisma.TickerDiscoveryUpsertArgs;

  const row = await tickerDiscovery.upsert(upsertArgs);

  return {
    tickerId: row.tickerId,
    expiresAt: row.expiresAt.toISOString(),
  };
}
