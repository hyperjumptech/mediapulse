import type { Prisma } from "@mediapulse/database";
import type { PublisherAuthorityRecordInput } from "@workspace/agent-data-api-contract";

type PublisherAuthorityDb = Pick<
  typeof import("@mediapulse/database").prisma.domainAuthority,
  "findMany" | "upsert"
>;

export type RecordPublisherAuthorityDeps = {
  domainAuthority: PublisherAuthorityDb;
  now?: Date;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function lookupStalePublisherAuthorityDomains(
  domains: readonly string[],
  ttlDays: number,
  domainAuthority: PublisherAuthorityDb,
  now: Date = new Date(),
): Promise<string[]> {
  const uniqueRequested = [...new Set(domains)];

  if (uniqueRequested.length === 0) {
    return [];
  }

  const freshAfter = new Date(now.getTime() - ttlDays * MS_PER_DAY);
  const findArgs = {
    where: {
      domain: { in: uniqueRequested },
      refreshedAt: { gt: freshAfter },
    },
    select: { domain: true },
  } satisfies Prisma.DomainAuthorityFindManyArgs;

  const rows = await domainAuthority.findMany(findArgs);
  const fresh = new Set(rows.map((row) => row.domain));

  return uniqueRequested.filter((domain) => !fresh.has(domain));
}

export async function recordPublisherAuthority(
  records: readonly PublisherAuthorityRecordInput[],
  deps: RecordPublisherAuthorityDeps,
): Promise<number> {
  const { domainAuthority } = deps;
  const now = deps.now ?? new Date();
  let recordedCount = 0;

  for (const record of records) {
    const asOf = record.asOf === null ? null : new Date(record.asOf);
    const values = {
      openPageRank: record.openPageRank,
      globalRank: record.globalRank,
      referringDomains: record.referringDomains,
      asOf: asOf !== null && !isNaN(asOf.getTime()) ? asOf : null,
      refreshedAt: now,
    };

    const upsertArgs = {
      where: { domain: record.domain },
      create: { domain: record.domain, ...values },
      update: values,
    } satisfies Prisma.DomainAuthorityUpsertArgs;

    await domainAuthority.upsert(upsertArgs);
    recordedCount += 1;
  }

  return recordedCount;
}
