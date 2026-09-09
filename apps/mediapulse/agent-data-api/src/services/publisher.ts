import type { Prisma } from "@mediapulse/database";
import type { prisma } from "@mediapulse/database";
import type {
  PublisherNameItem,
  PublisherNameSourceValue,
  PublisherSeenItem,
} from "@workspace/agent-data-api-contract";

type PublisherDb = Pick<
  typeof prisma.publisher,
  "findMany" | "create" | "update" | "updateMany"
>;

export type PublisherDeps = {
  publisher: PublisherDb;
  now?: Date;
};

const NAME_SOURCE_RANK: Record<PublisherNameSourceValue, number> = {
  derived: 0,
  llm: 1,
  site_metadata: 2,
  manual: 3,
};

/**
 * Records the publisher domains a collection run saw, creating a row for each new domain.
 *
 * - Important: An existing row's `displayName` is never touched, so a corrected name survives
 *   every later run that re-derives a worse one from the URL.
 *
 * @param publishers - Domains seen, each with the name derived from its URL.
 * @param deps - Prisma publisher delegate and optional clock.
 * @returns Counts of rows created and rows whose `lastSeenAt` advanced.
 */
export const upsertPublishersSeen = async (
  publishers: readonly PublisherSeenItem[],
  deps: PublisherDeps,
): Promise<{ createdCount: number; touchedCount: number }> => {
  const { publisher } = deps;
  const now = deps.now ?? new Date();
  const byDomain = new Map<string, PublisherSeenItem>();
  for (const item of publishers) {
    byDomain.set(item.domain, item);
  }
  const domains = [...byDomain.keys()];

  if (domains.length === 0) {
    return { createdCount: 0, touchedCount: 0 };
  }

  const existingRows = await publisher.findMany({
    where: { domain: { in: domains } },
    select: { domain: true },
  } satisfies Prisma.PublisherFindManyArgs);
  const existing = new Set(existingRows.map((row) => row.domain));
  const missing = domains.filter((domain) => !existing.has(domain));

  let createdCount = 0;
  for (const domain of missing) {
    const item = byDomain.get(domain);
    if (item === undefined) {
      continue;
    }

    try {
      await publisher.create({
        data: {
          domain,
          displayName: item.displayName,
          nameSource: "derived",
          lastSeenAt: now,
        },
      } satisfies Prisma.PublisherCreateArgs);
      createdCount += 1;
    } catch {
      // A concurrent run created the same domain between the lookup and this insert. The row
      // exists either way, so the miss is recorded as a touch below.
    }
  }

  const touched = await publisher.updateMany({
    where: { domain: { in: domains } },
    data: { lastSeenAt: now },
  } satisfies Prisma.PublisherUpdateManyArgs);

  return { createdCount, touchedCount: touched.count };
};

/**
 * Returns publishers whose display name is still the mechanical fallback derived from the URL.
 *
 * @param limit - Maximum rows to return.
 * @param deps - Prisma publisher delegate.
 * @returns Domains and their current derived names, most recently seen first.
 */
export const listUnresolvedPublishers = async (
  limit: number,
  deps: Pick<PublisherDeps, "publisher">,
): Promise<{ domain: string; displayName: string }[]> => {
  const rows = await deps.publisher.findMany({
    where: { nameSource: "derived" },
    select: { domain: true, displayName: true },
    orderBy: { lastSeenAt: "desc" },
    take: limit,
  } satisfies Prisma.PublisherFindManyArgs);

  return rows.map((row) => ({
    domain: row.domain,
    displayName: row.displayName,
  }));
};

/**
 * Writes resolved publisher names, keeping the better-sourced name when two disagree.
 *
 * - Important: A name is written only when its source ranks at or above the stored row's source,
 *   so site metadata cannot overwrite a manual correction.
 *
 * @param publishers - Names to record, each tagged with where it came from.
 * @param deps - Prisma publisher delegate and optional clock.
 * @returns Counts of rows updated and rows left alone because the stored name ranked higher.
 */
export const recordPublisherNames = async (
  publishers: readonly PublisherNameItem[],
  deps: PublisherDeps,
): Promise<{ updatedCount: number; skippedCount: number }> => {
  const { publisher } = deps;
  const now = deps.now ?? new Date();
  const domains = publishers.map((item) => item.domain);

  if (domains.length === 0) {
    return { updatedCount: 0, skippedCount: 0 };
  }

  const existingRows = await publisher.findMany({
    where: { domain: { in: domains } },
    select: { domain: true, nameSource: true },
  } satisfies Prisma.PublisherFindManyArgs);
  const rankByDomain = new Map(
    existingRows.map((row) => [row.domain, NAME_SOURCE_RANK[row.nameSource]]),
  );

  let updatedCount = 0;
  let skippedCount = 0;
  for (const item of publishers) {
    const storedRank = rankByDomain.get(item.domain);
    if (storedRank === undefined) {
      skippedCount += 1;
      continue;
    }
    if (NAME_SOURCE_RANK[item.nameSource] < storedRank) {
      skippedCount += 1;
      continue;
    }

    await publisher.update({
      where: { domain: item.domain },
      data: {
        displayName: item.displayName,
        nameSource: item.nameSource,
        lastSeenAt: now,
      },
    } satisfies Prisma.PublisherUpdateArgs);
    updatedCount += 1;
  }

  return { updatedCount, skippedCount };
};
