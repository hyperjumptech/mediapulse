import { prisma } from "@mediapulse/database";
import type { Prisma } from "@mediapulse/database";

const MAX_COMPETITOR_EDGE_FETCH = 50;
const MAX_COMPETITORS_DEFAULT = 8;

export type IssuerAnchor = {
  entityId: string;
  canonicalName: string;
  aliases: string[];
};

export type CompetitorEntry = {
  name: string;
  aliases: string[];
  relation: string;
  weight: number;
};

export type IssuerContextDb = {
  ticker: Pick<typeof prisma.ticker, "findUnique">;
  entityType: Pick<typeof prisma.entityType, "findFirst">;
  tickerEntity: Pick<typeof prisma.tickerEntity, "findFirst">;
  entityRelation: Pick<typeof prisma.entityRelation, "findMany">;
};

export const normalizeName = (value: string): string =>
  value.trim().toLowerCase();

/**
 * Resolves a ticker's issuer anchor entity (KG COMPANY seeded for the ticker), plus its aliases.
 *
 * @param tickerId - Ticker id to anchor.
 * @param db - Database delegates.
 * @returns The issuer anchor, or `null` when the ticker has no seeded COMPANY entity.
 */
export async function findIssuerAnchorForTicker(
  tickerId: string,
  db: Pick<IssuerContextDb, "ticker" | "entityType" | "tickerEntity">,
): Promise<IssuerAnchor | null> {
  const ticker = await db.ticker.findUnique({
    where: { id: tickerId },
    select: { symbol: true, name: true },
  } satisfies Prisma.TickerFindUniqueArgs);
  if (!ticker) return null;

  const companyType = await db.entityType.findFirst({
    where: { name: "COMPANY" },
    select: { id: true },
  } satisfies Prisma.EntityTypeFindFirstArgs);
  if (!companyType) return null;

  const tickerEntityRow = await db.tickerEntity.findFirst({
    where: {
      tickerId,
      source: "SEED",
      entity: { typeId: companyType.id },
    },
    select: {
      entityId: true,
      entity: {
        select: {
          canonicalName: true,
          aliases: { select: { alias: true } },
        },
      },
    },
  } satisfies Prisma.TickerEntityFindFirstArgs);
  if (!tickerEntityRow) return null;

  const storedAliases = tickerEntityRow.entity.aliases.map((row) => row.alias);
  const aliases = [
    ...new Set(
      [ticker.symbol, ticker.name, ...storedAliases].filter(
        (value) => value.length > 0,
      ),
    ),
  ];

  return {
    entityId: tickerEntityRow.entityId,
    canonicalName: tickerEntityRow.entity.canonicalName,
    aliases,
  };
}

/**
 * Reads COMPETITOR and SECTOR_PEER edges from the issuer entity, returning a
 * ranked, capped, self-excluded list of peer COMPANY entities.
 *
 * @param issuerEntityId - KG entity id for the ticker's issuer anchor.
 * @param issuerNormalizedAliasSet - Normalized alias strings for the issuer (self-exclusion guard).
 * @param opts - Optional cap override.
 * @param db - Database delegates.
 * @returns Competitor entries ordered by weight desc, then lastSeenAt desc.
 */
export async function getCompetitorsForTicker(
  issuerEntityId: string,
  issuerNormalizedAliasSet: ReadonlySet<string>,
  opts: { maxCompetitors?: number },
  db: Pick<IssuerContextDb, "entityRelation">,
): Promise<CompetitorEntry[]> {
  const maxCompetitors = opts.maxCompetitors ?? MAX_COMPETITORS_DEFAULT;

  const relations = await db.entityRelation.findMany({
    where: {
      OR: [{ fromEntityId: issuerEntityId }, { toEntityId: issuerEntityId }],
      relationType: {
        name: { in: ["COMPETITOR", "SECTOR_PEER"] },
      },
    },
    select: {
      fromEntityId: true,
      toEntityId: true,
      weight: true,
      relationType: { select: { name: true } },
      fromEntity: {
        select: {
          id: true,
          canonicalName: true,
          type: { select: { name: true } },
          aliases: { select: { alias: true } },
        },
      },
      toEntity: {
        select: {
          id: true,
          canonicalName: true,
          type: { select: { name: true } },
          aliases: { select: { alias: true } },
        },
      },
    },
    orderBy: [{ weight: "desc" }, { lastSeenAt: "desc" }],
    take: MAX_COMPETITOR_EDGE_FETCH,
  } satisfies Prisma.EntityRelationFindManyArgs);

  const seenEntityIds = new Set<string>();
  const competitors: CompetitorEntry[] = [];

  for (const relation of relations) {
    if (competitors.length >= maxCompetitors) break;

    const peerEntity =
      relation.fromEntityId === issuerEntityId
        ? relation.toEntity
        : relation.fromEntity;

    if (peerEntity.type.name !== "COMPANY") continue;
    if (peerEntity.id === issuerEntityId) continue;

    const peerNormalizedName = normalizeName(peerEntity.canonicalName);
    if (issuerNormalizedAliasSet.has(peerNormalizedName)) continue;
    const peerNormalizedAliases = peerEntity.aliases.map((aliasRow) =>
      normalizeName(aliasRow.alias),
    );
    if (
      peerNormalizedAliases.some((alias) => issuerNormalizedAliasSet.has(alias))
    )
      continue;

    if (seenEntityIds.has(peerEntity.id)) continue;
    seenEntityIds.add(peerEntity.id);

    competitors.push({
      name: peerEntity.canonicalName,
      aliases: peerEntity.aliases.map((aliasRow) => aliasRow.alias),
      relation: relation.relationType.name,
      weight: relation.weight,
    });
  }

  return competitors;
}
