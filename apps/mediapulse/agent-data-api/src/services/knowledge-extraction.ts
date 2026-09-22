/**
 * Writes a Ticker's knowledge base: the relation-kind registry, the entities its profile names, and
 * whatever extraction reports from its articles.
 *
 * Every guard an extracting agent applies is applied again here, because the agent is an untrusted
 * caller: a claim whose span is not in the stored article must not reach the database however it was
 * produced.
 */

import type { PrismaClient } from "@mediapulse/database";
import { normalizeEntityName, textNamesEntity } from "@workspace/utils";

const DISCARDED_ENTITY_KINDS = new Set<string>(["person"]);
import type {
  KnowledgeExtractedEntity,
  KnowledgeExtractionRejection,
} from "@workspace/agent-data-api-contract";

export type KnowledgeExtractionDb = Pick<
  PrismaClient,
  | "ticker"
  | "dataSource"
  | "knowledgeEntity"
  | "knowledgeEntityAlias"
  | "knowledgeTickerEntity"
  | "knowledgeRelation"
  | "knowledgeRelationKind"
  | "knowledgeRelationKindAlias"
  | "knowledgeTickerRelation"
  | "knowledgeEntityMention"
  | "knowledgeExtractionRun"
>;

type Db = KnowledgeExtractionDb;

export type SeedRelationKindInput = {
  slug: string;
  label: string;
  inverseLabel: string | null;
  symmetric: boolean;
  aliases: readonly string[];
  invertedAliases: readonly string[];
};

export type ProfileParty = {
  name: string;
  aliases: readonly string[];
};

export type EntityKindName = KnowledgeExtractedEntity["kind"];

/** How an emitted relation phrase resolved against the registry. */
export type ResolvedRelationKind = {
  slug: string;
  /** True when the phrase read the relation backwards and the endpoints must be swapped. */
  inverted: boolean;
  /** True when the registry had no row and one was created. */
  created: boolean;
};

/**
 * Creates the seed relation kinds and their aliases if they are absent.
 *
 * @param db - Local Prisma client.
 * @param kinds - Kinds to seed.
 */
export const seedRelationKinds = async (
  db: Db,
  kinds: readonly SeedRelationKindInput[],
): Promise<void> => {
  for (const kind of kinds) {
    await db.knowledgeRelationKind.upsert({
      where: { slug: kind.slug },
      create: {
        slug: kind.slug,
        label: kind.label,
        inverseLabel: kind.inverseLabel,
        symmetric: kind.symmetric,
        curated: true,
      },
      update: {
        label: kind.label,
        inverseLabel: kind.inverseLabel,
        symmetric: kind.symmetric,
        curated: true,
      },
    });

    const aliasRows = [
      ...kind.aliases.map((alias) => ({ alias, inverted: false })),
      ...kind.invertedAliases.map((alias) => ({ alias, inverted: true })),
      { alias: kind.label, inverted: false },
    ];
    for (const row of aliasRows) {
      const normalizedAlias = normalizeEntityName(row.alias);
      if (normalizedAlias.length === 0) {
        continue;
      }
      await db.knowledgeRelationKindAlias.upsert({
        where: {
          kindSlug_normalizedAlias: { kindSlug: kind.slug, normalizedAlias },
        },
        create: {
          kindSlug: kind.slug,
          normalizedAlias,
          alias: row.alias,
          inverted: row.inverted,
          source: "profile",
        },
        update: { alias: row.alias, inverted: row.inverted },
      });
    }
  }
};

/**
 * Resolves an emitted relation phrase to a registry slug, creating an uncurated kind when the
 * phrase is new.
 *
 * @param db - Local Prisma client.
 * @param phrase - The phrase as the model wrote it.
 * @param extractionRunId - Run to attribute a newly created kind to.
 * @returns The slug, whether the phrase read backwards, and whether a row was created.
 */
export const resolveRelationKind = async (
  db: Db,
  phrase: string,
  extractionRunId: string | null,
): Promise<ResolvedRelationKind | null> => {
  const normalizedAlias = normalizeEntityName(phrase);
  if (normalizedAlias.length === 0) {
    return null;
  }

  const alias = await db.knowledgeRelationKindAlias.findFirst({
    where: { normalizedAlias },
  });
  if (alias !== null) {
    return { slug: alias.kindSlug, inverted: alias.inverted, created: false };
  }

  const slug = normalizedAlias.replace(/\s+/gu, "_");
  const existing = await db.knowledgeRelationKind.findUnique({
    where: { slug },
  });
  if (existing !== null) {
    return { slug, inverted: false, created: false };
  }

  await db.knowledgeRelationKind.create({
    data: {
      slug,
      label: phrase.trim().toLowerCase(),
      inverseLabel: null,
      symmetric: false,
      curated: false,
      observations: 0,
      extractionRunId,
    },
  });
  await db.knowledgeRelationKindAlias.create({
    data: {
      kindSlug: slug,
      normalizedAlias,
      alias: phrase.trim(),
      inverted: false,
      source: "extracted",
    },
  });

  return { slug, inverted: false, created: true };
};

export type UpsertEntityInput = {
  kind: EntityKindName;
  canonicalName: string;
  /** Other spellings to try before creating, and to record once the entity exists. */
  aliases?: readonly string[];
  tickerId?: string | null;
  source: "profile" | "extracted" | "operator";
  extractionRunId?: string | null;
};

export type UpsertEntityResult = {
  id: string;
  created: boolean;
};

/**
 * Finds the entity any of these normalised spellings already belongs to.
 *
 * - Important: resolution is by name alone, never by name and kind. One body read as a regulator in
 *   one article and as an organisation in the next is still one body.
 *
 * @param db - Prisma delegates.
 * @param spellings - Normalised names and aliases to try, in order of preference.
 * @returns The entity id, or undefined when nothing matches.
 */
const resolveEntityId = async (
  db: Db,
  spellings: readonly string[],
): Promise<string | undefined> => {
  for (const spelling of spellings) {
    const byName = await db.knowledgeEntity.findUnique({
      where: { normalizedName: spelling },
      select: { id: true },
    });
    if (byName !== null) {
      return byName.id;
    }
    const byAlias = await db.knowledgeEntityAlias.findFirst({
      where: { normalizedAlias: spelling },
      select: { entityId: true },
    });
    if (byAlias !== null) {
      return byAlias.entityId;
    }
  }

  return undefined;
};

/**
 * Finds an entity by any of its names, or creates it.
 *
 * Every spelling the caller holds is resolved before anything is created, so an article's own wording
 * joins the entity a Ticker Profile already seeded rather than forking it.
 *
 * @param db - Local Prisma client.
 * @param input - The entity as the caller knows it.
 */
export const upsertEntity = async (
  db: Db,
  input: UpsertEntityInput,
): Promise<UpsertEntityResult> => {
  const normalizedName = normalizeEntityName(input.canonicalName);
  if (normalizedName.length === 0) {
    throw new Error(`"${input.canonicalName}" normalises to nothing`);
  }

  // Every spelling in hand is tried before creating anything. An extraction that returns
  // "Badan Pengawas Obat dan Makanan" for the party an article calls "BPOM" must land on the entity
  // the Ticker Profile already seeded under that alias, not beside it.
  const spellings = [
    normalizedName,
    ...(input.aliases ?? []).map((alias) => normalizeEntityName(alias)),
  ].filter((spelling) => spelling.length > 0);

  const existingId = await resolveEntityId(db, spellings);

  const entityId =
    existingId ??
    (
      await db.knowledgeEntity.create({
        data: {
          kind: input.kind,
          canonicalName: input.canonicalName,
          normalizedName,
          tickerId: input.tickerId ?? null,
          source: input.source,
          extractionRunId: input.extractionRunId ?? null,
        },
        select: { id: true },
      })
    ).id;

  for (const alias of [input.canonicalName, ...(input.aliases ?? [])]) {
    const normalizedAlias = normalizeEntityName(alias);
    if (normalizedAlias.length === 0) {
      continue;
    }
    await db.knowledgeEntityAlias.upsert({
      where: { entityId_normalizedAlias: { entityId, normalizedAlias } },
      create: {
        entityId,
        normalizedAlias,
        alias,
        source: input.source,
      },
      update: {},
    });
  }

  return { id: entityId, created: existingId === undefined };
};

/**
 * Links an entity to a ticker's knowledge base.
 *
 * @param db - Local Prisma client.
 * @param input - Ticker, entity, and how the link arose.
 */
export const linkEntityToTicker = async (
  db: Db,
  input: {
    tickerId: string;
    entityId: string;
    isIssuer?: boolean;
    source: "profile" | "extracted" | "operator";
  },
): Promise<void> => {
  // One issuer entity per Ticker. Postgres would say this in a partial unique index, which Prisma
  // cannot express and the next `migrate dev` would drop, so the write path says it instead.
  if (input.isIssuer === true) {
    const existing = await db.knowledgeTickerEntity.findFirst({
      where: { tickerId: input.tickerId, isIssuer: true },
      select: { entityId: true },
    });
    if (existing !== null && existing.entityId !== input.entityId) {
      throw new Error(
        `Ticker ${input.tickerId} already has an issuer entity (${existing.entityId})`,
      );
    }
  }

  await db.knowledgeTickerEntity.upsert({
    where: {
      tickerId_entityId: { tickerId: input.tickerId, entityId: input.entityId },
    },
    create: {
      tickerId: input.tickerId,
      entityId: input.entityId,
      isIssuer: input.isIssuer ?? false,
      source: input.source,
    },
    update: { lastSeenAt: new Date() },
  });
};

export type UpsertRelationInput = {
  tickerId: string;
  subjectEntityId: string;
  objectEntityId: string;
  kindSlug: string;
  label: string | null;
  source: "profile" | "extracted" | "operator";
  evidenceDataSourceId?: string | null;
  evidenceSpan?: string | null;
  extractionRunId?: string | null;
};

export type UpsertRelationResult = {
  id: string;
  /** False when the relation already existed and this observation only confirmed it. */
  opened: boolean;
};

/**
 * Records a relation and links it to a ticker, confirming rather than duplicating one already held.
 *
 * @param db - Local Prisma client.
 * @param input - The relation and its evidence.
 */
export const upsertRelation = async (
  db: Db,
  input: UpsertRelationInput,
): Promise<UpsertRelationResult> => {
  const key = {
    subjectEntityId_kindSlug_objectEntityId: {
      subjectEntityId: input.subjectEntityId,
      kindSlug: input.kindSlug,
      objectEntityId: input.objectEntityId,
    },
  };
  const existing = await db.knowledgeRelation.findUnique({
    where: key,
    select: { id: true, evidenceSpan: true },
  });

  const relation =
    existing === null
      ? await db.knowledgeRelation.create({
          data: {
            subjectEntityId: input.subjectEntityId,
            objectEntityId: input.objectEntityId,
            kindSlug: input.kindSlug,
            label: input.label,
            source: input.source,
            evidenceDataSourceId: input.evidenceDataSourceId ?? null,
            evidenceSpan: input.evidenceSpan ?? null,
            extractionRunId: input.extractionRunId ?? null,
          },
          select: { id: true },
        })
      : await db.knowledgeRelation.update({
          where: key,
          data: {
            observations: { increment: 1 },
            lastObservedAt: new Date(),
            // A relation first seeded from the profile gains its first real citation here.
            ...(existing.evidenceSpan === null && input.evidenceSpan
              ? {
                  evidenceSpan: input.evidenceSpan,
                  evidenceDataSourceId: input.evidenceDataSourceId ?? null,
                  source: input.source,
                  label: input.label,
                }
              : {}),
          },
          select: { id: true },
        });

  await db.knowledgeRelationKind.update({
    where: { slug: input.kindSlug },
    data: { observations: { increment: 1 }, lastObservedAt: new Date() },
  });
  await db.knowledgeTickerRelation.upsert({
    where: {
      tickerId_relationId: {
        tickerId: input.tickerId,
        relationId: relation.id,
      },
    },
    create: {
      tickerId: input.tickerId,
      relationId: relation.id,
      source: input.source,
    },
    update: {},
  });

  return { id: relation.id, opened: existing === null };
};

/**
 * Records that one article named one entity while being read for one ticker.
 *
 * @param db - Local Prisma client.
 * @param input - The mention and its evidence.
 * @returns True when the mention is new for this ticker.
 */
export const recordMention = async (
  db: Db,
  input: {
    tickerId: string;
    entityId: string;
    dataSourceId: string;
    surfaceForm: string | null;
    evidenceSpan: string | null;
    extractionRunId: string | null;
  },
): Promise<boolean> => {
  const key = {
    tickerId_entityId_dataSourceId: {
      tickerId: input.tickerId,
      entityId: input.entityId,
      dataSourceId: input.dataSourceId,
    },
  };
  const existing = await db.knowledgeEntityMention.findUnique({
    where: key,
    select: { tickerId: true },
  });
  if (existing !== null) {
    return false;
  }

  await db.knowledgeEntityMention.create({
    data: {
      tickerId: input.tickerId,
      entityId: input.entityId,
      dataSourceId: input.dataSourceId,
      surfaceForm: input.surfaceForm,
      evidenceSpan: input.evidenceSpan,
      extractionRunId: input.extractionRunId,
    },
  });
  await db.knowledgeTickerEntity.update({
    where: {
      tickerId_entityId: { tickerId: input.tickerId, entityId: input.entityId },
    },
    data: { mentionCount: { increment: 1 }, lastSeenAt: new Date() },
  });

  return true;
};

/**
 * Relabels each of a ticker's entities to the spelling its corpus uses most.
 *
 * A curated profile calls a competitor by its registered name, and the press rarely does: FORE's
 * profile says "Mitra Adiperkasa" where 28 articles say "Starbucks". The label a reader sees should
 * be the one the reader has read.
 *
 * @param db - Local Prisma client.
 * @param tickerId - Ticker whose corpus decides the labels.
 * @returns How many entities were relabelled.
 */
export const relabelEntitiesFromCorpus = async (
  db: Db,
  tickerId: string,
): Promise<number> => {
  const mentions = await db.knowledgeEntityMention.groupBy({
    by: ["entityId", "surfaceForm"],
    where: { tickerId, surfaceForm: { not: null } },
    _count: { dataSourceId: true },
  });

  const best = new Map<string, { form: string; count: number }>();
  for (const row of mentions) {
    if (row.surfaceForm === null) {
      continue;
    }
    const current = best.get(row.entityId);
    const count = row._count.dataSourceId;
    if (current === undefined || count > current.count) {
      best.set(row.entityId, { form: row.surfaceForm, count });
    }
  }

  let relabelled = 0;
  for (const [entityId, winner] of best) {
    const entity = await db.knowledgeEntity.findUnique({
      where: { id: entityId },
      select: { canonicalName: true, tickerId: true },
    });
    // The issuer keeps its registered name: its node is the graph's anchor.
    if (entity === null || entity.tickerId !== null) {
      continue;
    }
    if (entity.canonicalName === winner.form) {
      continue;
    }
    await db.knowledgeEntity.update({
      where: { id: entityId },
      data: { canonicalName: winner.form },
    });
    relabelled += 1;
  }

  return relabelled;
};

/** Collapses whitespace so a span that differs only in line breaks still matches. */
const flatten = (value: string): string =>
  value.replace(/\s+/gu, " ").trim().toLowerCase();

/**
 * Whether a span appears in an article as written.
 *
 * @param articleText - Title, description and body as one block.
 * @param span - The span a caller claims to have copied.
 */
export const spanIsInArticle = (articleText: string, span: string): boolean => {
  const needle = flatten(span);

  return needle.length > 0 && flatten(articleText).includes(needle);
};

const asParties = (value: unknown): ProfileParty[] =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        if (typeof entry !== "object" || entry === null) {
          return [];
        }
        const record = entry as Record<string, unknown>;
        if (typeof record.name !== "string") {
          return [];
        }

        return [
          {
            name: record.name,
            aliases: Array.isArray(record.aliases)
              ? record.aliases.filter(
                  (alias): alias is string => typeof alias === "string",
                )
              : [],
          },
        ];
      })
    : [];

/**
 * Newest watermark left by an extraction run that finished successfully for one issuer.
 *
 * - Important: failed runs are ignored, because advancing past a batch that errored halfway would
 *   skip every article it never reached.
 *
 * @param db - Prisma delegates.
 * @param tickerId - Issuer whose runs to read.
 */
export async function latestExtractionWatermark(
  db: Db,
  tickerId: string,
): Promise<string | null> {
  const run = await db.knowledgeExtractionRun.findFirst({
    where: { tickerId, status: "success", watermarkAt: { not: null } },
    orderBy: { watermarkAt: "desc" },
    select: { watermarkAt: true },
  });

  return run?.watermarkAt?.toISOString() ?? null;
}

export type ExtractionCandidates = {
  issuer: {
    tickerId: string;
    symbol: string;
    name: string;
    aliases: string[];
    companyOverview: string | null;
  };
  parties: { name: string; aliases: string[]; kind: EntityKindName }[];
  relationKindLabels: string[];
  articles: {
    dataSourceId: string;
    title: string;
    description: string | null;
    content: string | null;
    observedAt: string;
  }[];
  watermark: string | null;
  resumedFrom: string | null;
};

/**
 * Lists what one issuer's extraction pass needs: its profile's parties, the curated vocabulary, and
 * the articles a Section admitted for it that no extraction has read yet.
 *
 * - Important: only articles with a Placement for this issuer are returned. An article this issuer's
 *   pipeline rejected says nothing about the issuer's market, and reading it would put entities in
 *   the graph that the newsletter itself declined to carry.
 * - Important: only curated relation kinds are offered. Sending the observed ones back to the model
 *   makes every kind it invents more likely the next night.
 *
 * @param db - Prisma delegates.
 * @param query - Issuer, optional lower bound, and how many articles to take.
 */
export async function listExtractionCandidates(
  db: Db,
  query: {
    tickerId: string;
    since?: string;
    fromStart?: boolean;
    take?: number;
  },
): Promise<ExtractionCandidates | null> {
  const ticker = await db.ticker.findUnique({
    where: { id: query.tickerId },
    include: { profile: true },
  });
  if (ticker === null) {
    return null;
  }

  const storedWatermark = await latestExtractionWatermark(db, query.tickerId);
  const resumedFrom =
    query.fromStart === true ? null : (query.since ?? storedWatermark);

  const articles = await db.dataSource.findMany({
    where: {
      tickerSections: {
        some: { tickerId: query.tickerId, section: { not: null } },
      },
      ...(resumedFrom === null
        ? {}
        : { createdAt: { gt: new Date(resumedFrom) } }),
      knowledgeMentions: { none: { tickerId: query.tickerId } },
    },
    orderBy: { createdAt: "asc" },
    take: query.take ?? 100,
    select: {
      id: true,
      title: true,
      description: true,
      content: true,
      createdAt: true,
    },
  });

  const competitors = asParties(ticker.profile?.competitors);
  const regulators = asParties(ticker.profile?.regulators);
  const kinds = await db.knowledgeRelationKind.findMany({
    where: { curated: true },
    select: { label: true },
    orderBy: [{ observations: "desc" }, { slug: "asc" }],
    take: 40,
  });

  const newest = articles[articles.length - 1]?.createdAt ?? null;

  return {
    issuer: {
      tickerId: ticker.id,
      symbol: ticker.symbol,
      name: ticker.name,
      aliases: ticker.profile?.aliases ?? ticker.aliases,
      companyOverview: ticker.profile?.companyOverview ?? null,
    },
    parties: [
      ...competitors.map((party) => ({
        name: party.name,
        aliases: [...party.aliases],
        kind: "company" as EntityKindName,
      })),
      ...regulators.map((party) => ({
        name: party.name,
        aliases: [...party.aliases],
        kind: "regulator" as EntityKindName,
      })),
    ],
    relationKindLabels: kinds.map((kind) => kind.label),
    articles: articles.map((article) => ({
      dataSourceId: article.id,
      title: article.title,
      description: article.description,
      content: article.content,
      observedAt: article.createdAt.toISOString(),
    })),
    watermark: newest === null ? storedWatermark : newest.toISOString(),
    resumedFrom,
  };
}

/**
 * Seeds one issuer's knowledge base from its Ticker Profile.
 *
 * The issuer's own entity, one entity per curated competitor and regulator, and the relations
 * between them. Every row is marked `profile`, carries no evidence span, and is counted separately
 * in the dashboard, because curated input is not something an article stands behind.
 *
 * @param db - Prisma delegates.
 * @param tickerId - Issuer to seed.
 * @param extractionRunId - Run to attribute new rows to.
 * @param seedKinds - Relation kinds to seed the registry with.
 */
export async function seedKnowledgeBaseFromProfile(
  db: Db,
  tickerId: string,
  extractionRunId: string | null,
  seedKinds: readonly SeedRelationKindInput[],
): Promise<{
  issuerEntityId: string;
  entitiesCreated: number;
  relationsOpened: number;
  relationsConfirmed: number;
} | null> {
  const ticker = await db.ticker.findUnique({
    where: { id: tickerId },
    include: { profile: true },
  });
  if (ticker === null) {
    return null;
  }

  await seedRelationKinds(db, seedKinds);

  const issuer = await upsertEntity(db, {
    kind: "issuer",
    canonicalName: ticker.name,
    aliases: [ticker.symbol, ...(ticker.profile?.aliases ?? ticker.aliases)],
    tickerId: ticker.id,
    source: "profile",
  });
  await linkEntityToTicker(db, {
    tickerId: ticker.id,
    entityId: issuer.id,
    isIssuer: true,
    source: "profile",
  });

  let entitiesCreated = issuer.created ? 1 : 0;
  let relationsOpened = 0;
  let relationsConfirmed = 0;

  const seedParty = async (
    party: ProfileParty,
    kind: EntityKindName,
    kindSlug: string,
    issuerIsSubject: boolean,
  ): Promise<void> => {
    const entity = await upsertEntity(db, {
      kind,
      canonicalName: party.name,
      aliases: party.aliases,
      source: "profile",
      extractionRunId,
    });
    if (entity.created) {
      entitiesCreated += 1;
    }
    await linkEntityToTicker(db, {
      tickerId: ticker.id,
      entityId: entity.id,
      source: "profile",
    });
    const relation = await upsertRelation(db, {
      tickerId: ticker.id,
      subjectEntityId: issuerIsSubject ? issuer.id : entity.id,
      objectEntityId: issuerIsSubject ? entity.id : issuer.id,
      kindSlug,
      label: null,
      source: "profile",
    });
    if (relation.opened) {
      relationsOpened += 1;
    } else {
      relationsConfirmed += 1;
    }
  };

  for (const party of asParties(ticker.profile?.competitors)) {
    await seedParty(party, "company", "competes_with", true);
  }
  for (const party of asParties(ticker.profile?.regulators)) {
    await seedParty(party, "regulator", "regulates", false);
  }

  return {
    issuerEntityId: issuer.id,
    entitiesCreated,
    relationsOpened,
    relationsConfirmed,
  };
}

export type ApplyExtractionInput = {
  tickerId: string;
  dataSourceId: string;
  extractionRunId: string | null;
  entities: readonly KnowledgeExtractedEntity[];
  relations: readonly {
    subject: string;
    kind: string;
    object: string;
    evidenceSpan: string;
  }[];
};

export type ApplyExtractionResult = {
  entitiesCreated: number;
  mentionsWritten: number;
  relationsOpened: number;
  relationsConfirmed: number;
  kindsCreated: number;
  rejected: KnowledgeExtractionRejection[];
};

/** A regulator is always the subject of `regulates`, whichever way the caller wrote it. */
const orientEndpoints = (
  subject: { id: string; kind: EntityKindName },
  object: { id: string; kind: EntityKindName },
  kindSlug: string,
): { subjectId: string; objectId: string } => {
  if (
    kindSlug === "regulates" &&
    object.kind === "regulator" &&
    subject.kind !== "regulator"
  ) {
    return { subjectId: object.id, objectId: subject.id };
  }

  return { subjectId: subject.id, objectId: object.id };
};

/**
 * Applies one article's extraction to one issuer's knowledge base.
 *
 * @param db - Prisma delegates.
 * @param input - The article, the issuer, and what a caller reported about them.
 * @returns What was written, and every claim that failed a guard.
 * @throws When the article or the issuer does not exist.
 */
export async function applyExtraction(
  db: Db,
  input: ApplyExtractionInput,
): Promise<ApplyExtractionResult> {
  const article = await db.dataSource.findUnique({
    where: { id: input.dataSourceId },
    select: { id: true, title: true, description: true, content: true },
  });
  if (article === null) {
    throw new Error(`Data Source ${input.dataSourceId} does not exist`);
  }
  const ticker = await db.ticker.findUnique({
    where: { id: input.tickerId },
    select: { id: true, symbol: true, name: true, aliases: true },
  });
  if (ticker === null) {
    throw new Error(`Ticker ${input.tickerId} does not exist`);
  }

  const articleText = [
    article.title,
    article.description ?? "",
    article.content ?? "",
  ].join("\n\n");

  const result: ApplyExtractionResult = {
    entitiesCreated: 0,
    mentionsWritten: 0,
    relationsOpened: 0,
    relationsConfirmed: 0,
    kindsCreated: 0,
    rejected: [],
  };

  const issuerLink = await db.knowledgeTickerEntity.findFirst({
    where: { tickerId: input.tickerId, isIssuer: true },
    select: { entityId: true },
  });

  const idsByName = new Map<string, { id: string; kind: EntityKindName }>();
  if (issuerLink !== null) {
    for (const known of [ticker.name, ticker.symbol, ...ticker.aliases]) {
      idsByName.set(normalizeEntityName(known), {
        id: issuerLink.entityId,
        kind: "issuer",
      });
    }
  }

  for (const entity of input.entities) {
    if (DISCARDED_ENTITY_KINDS.has(entity.kind)) {
      result.rejected.push({ reason: "person", detail: entity.name });

      continue;
    }
    if (!spanIsInArticle(articleText, entity.evidenceSpan)) {
      result.rejected.push({
        reason: "span-not-in-text",
        detail: entity.name,
      });

      continue;
    }
    if (
      !textNamesEntity(articleText, entity.surfaceForm) &&
      !textNamesEntity(articleText, entity.name)
    ) {
      result.rejected.push({
        reason: "name-not-in-text",
        detail: entity.name,
      });

      continue;
    }
    // An article cannot introduce the issuer as a third party; it already has an entity.
    const kind: EntityKindName =
      entity.kind === "issuer" ? "company" : entity.kind;
    const stored = await upsertEntity(db, {
      kind,
      canonicalName: entity.name,
      aliases: [entity.surfaceForm],
      source: "extracted",
      extractionRunId: input.extractionRunId,
    });
    if (stored.created) {
      result.entitiesCreated += 1;
    }
    await linkEntityToTicker(db, {
      tickerId: input.tickerId,
      entityId: stored.id,
      source: "extracted",
    });
    const written = await recordMention(db, {
      tickerId: input.tickerId,
      entityId: stored.id,
      dataSourceId: article.id,
      surfaceForm: entity.surfaceForm,
      evidenceSpan: entity.evidenceSpan,
      extractionRunId: input.extractionRunId,
    });
    if (written) {
      result.mentionsWritten += 1;
    }
    idsByName.set(normalizeEntityName(entity.name), { id: stored.id, kind });
    idsByName.set(normalizeEntityName(entity.surfaceForm), {
      id: stored.id,
      kind,
    });
  }

  for (const relation of input.relations) {
    const label = `${relation.subject} ${relation.kind} ${relation.object}`;
    if (!spanIsInArticle(articleText, relation.evidenceSpan)) {
      result.rejected.push({ reason: "span-not-in-text", detail: label });

      continue;
    }
    const subject = idsByName.get(normalizeEntityName(relation.subject));
    const object = idsByName.get(normalizeEntityName(relation.object));
    if (subject === undefined || object === undefined) {
      result.rejected.push({ reason: "endpoint-unknown", detail: label });

      continue;
    }
    if (subject.id === object.id) {
      result.rejected.push({ reason: "self-relation", detail: label });

      continue;
    }
    const kind = await resolveRelationKind(
      db,
      relation.kind,
      input.extractionRunId,
    );
    if (kind === null) {
      continue;
    }
    if (kind.created) {
      result.kindsCreated += 1;
    }
    const ends = kind.inverted
      ? orientEndpoints(object, subject, kind.slug)
      : orientEndpoints(subject, object, kind.slug);
    const written = await upsertRelation(db, {
      tickerId: input.tickerId,
      subjectEntityId: ends.subjectId,
      objectEntityId: ends.objectId,
      kindSlug: kind.slug,
      label: relation.kind,
      source: "extracted",
      evidenceDataSourceId: article.id,
      evidenceSpan: relation.evidenceSpan,
      extractionRunId: input.extractionRunId,
    });
    if (written.opened) {
      result.relationsOpened += 1;
    } else {
      result.relationsConfirmed += 1;
    }
  }

  return result;
}

/**
 * Opens an extraction run.
 *
 * @param db - Prisma delegates.
 * @param body - Issuer, correlation, agent version and start time.
 */
export async function startExtractionRun(
  db: Db,
  body: {
    tickerId: string | null;
    scheduleExecutionId: string | null;
    agentVersion: string | null;
    startedAt: string;
  },
): Promise<{ extractionRunId: string }> {
  const run = await db.knowledgeExtractionRun.create({
    data: {
      tickerId: body.tickerId,
      scheduleExecutionId: body.scheduleExecutionId,
      agentVersion: body.agentVersion,
      startedAt: new Date(body.startedAt),
      status: "running",
    },
    select: { id: true },
  });

  return { extractionRunId: run.id };
}

/**
 * Closes an extraction run with its tally, and relabels the issuer's entities to their corpus
 * spelling.
 *
 * Relabelling happens here so it runs once per pass whoever drove it, rather than being something a
 * caller can forget.
 *
 * @param db - Prisma delegates.
 * @param body - Run id, outcome, watermark and counters.
 */
export async function finishExtractionRun(
  db: Db,
  body: {
    extractionRunId: string;
    status: "success" | "partial_success" | "failed";
    completedAt: string;
    watermarkAt: string | null;
    considered: number;
    skippedNoCandidates: number;
    entitiesCreated: number;
    relationsOpened: number;
    relationsConfirmed: number;
    mentionsWritten: number;
    kindsCreated: number;
    rejectedSpanNotInText: number;
    rejectedNameNotInText: number;
    rejectedPerson?: number;
    stopReason: string | null;
    durationMs: number | null;
  },
): Promise<void> {
  const run = await db.knowledgeExtractionRun.update({
    where: { id: body.extractionRunId },
    data: {
      status: body.status,
      completedAt: new Date(body.completedAt),
      watermarkAt:
        body.watermarkAt === null ? null : new Date(body.watermarkAt),
      considered: body.considered,
      skippedNoCandidates: body.skippedNoCandidates,
      entitiesCreated: body.entitiesCreated,
      relationsOpened: body.relationsOpened,
      relationsConfirmed: body.relationsConfirmed,
      mentionsWritten: body.mentionsWritten,
      kindsCreated: body.kindsCreated,
      rejectedSpanNotInText: body.rejectedSpanNotInText,
      rejectedNameNotInText: body.rejectedNameNotInText,
      rejectedPerson: body.rejectedPerson ?? 0,
      stopReason: body.stopReason,
      durationMs: body.durationMs,
    },
    select: { tickerId: true },
  });

  if (run.tickerId !== null) {
    await relabelEntitiesFromCorpus(db, run.tickerId);
  }
}
