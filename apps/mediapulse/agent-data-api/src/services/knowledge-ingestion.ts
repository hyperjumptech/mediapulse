import type { PrismaClient } from "@mediapulse/database";
import {
  KNOWLEDGE_CANDIDATE_STORYLINE_MAX,
  knowledgeLockReason,
  type GetKnowledgeCandidateSourcesResponse,
  type KnowledgeStorylineSnapshot,
  type KnowledgeWriteResult,
  type PostKnowledgeDevelopmentCitationsBody,
  type PostKnowledgeDevelopmentsBody,
  type PostKnowledgeIngestionRunsBody,
  type PostKnowledgeIngestionRunsFinishBody,
  type PostKnowledgeStorylinesBody,
} from "@workspace/agent-data-api-contract";

export type KnowledgeDb = Pick<
  PrismaClient,
  | "dataSource"
  | "storyline"
  | "storylineAnchor"
  | "storylineTicker"
  | "development"
  | "developmentAnchor"
  | "developmentCitation"
  | "knowledgeIngestionRun"
>;

const dayOf = (value: Date | null): string | null =>
  value === null ? null : value.toISOString().slice(0, 10);

/**
 * Newest watermark left by a run that finished successfully.
 *
 * - Important: failed runs are ignored. Advancing past a batch that errored halfway would skip the
 *   articles it never reached, and nothing would ever revisit them.
 *
 * @param db - Prisma delegates.
 */
export async function latestKnowledgeWatermark(
  db: KnowledgeDb,
): Promise<string | undefined> {
  const run = await db.knowledgeIngestionRun.findFirst({
    where: { status: "success", watermarkAt: { not: null } },
    orderBy: { watermarkAt: "desc" },
    select: { watermarkAt: true },
  });

  return run?.watermarkAt?.toISOString();
}

/**
 * Lists Data Sources for ingestion, oldest first.
 *
 * - Important: the whole collected corpus is returned, not only articles a Section admitted. A
 *   thread grouped from admitted articles alone would depend on the classification it is meant to
 *   inform, and would then amplify its own errors.
 *
 * @param since - Only sources created after this instant. Falls back to the stored watermark.
 * @param take - Maximum sources to return.
 * @param db - Prisma delegates.
 * @param fromStart - Ignores the stored watermark and rebuilds from the oldest Data Source.
 */
export async function listKnowledgeCandidateSources(
  since: string | undefined,
  take: number,
  db: KnowledgeDb,
  fromStart = false,
): Promise<GetKnowledgeCandidateSourcesResponse> {
  const resumeAt =
    since ?? (fromStart ? undefined : await latestKnowledgeWatermark(db));
  const rows = await db.dataSource.findMany({
    where:
      resumeAt === undefined ? {} : { createdAt: { gt: new Date(resumeAt) } },
    orderBy: { createdAt: "asc" },
    take,
    select: {
      id: true,
      title: true,
      description: true,
      content: true,
      createdAt: true,
      publishedAt: true,
      tickerSections: {
        where: { section: { not: null } },
        select: { tickerId: true },
      },
    },
  });

  const sources = rows.map((row) => ({
    dataSourceId: row.id,
    title: row.title,
    text: row.content ?? row.description ?? "",
    observedAt: row.createdAt.toISOString(),
    publishedDay: dayOf(row.publishedAt),
    tickerIds: [...new Set(row.tickerSections.map((link) => link.tickerId))],
  }));
  const watermark = rows.at(-1)?.createdAt.toISOString() ?? null;

  return { sources, watermark, resumedFrom: resumeAt ?? null };
}

/**
 * Retrieves Storylines sharing at least one anchor with the candidate.
 *
 * - Important: retrieval is by anchor rather than by Ticker. Storylines are global, so narrowing by
 *   the candidate's own tickers would hide a thread opened under another issuer and fork it.
 *
 * @param anchors - The candidate's distinctive anchors.
 * @param db - Prisma delegates.
 */
export async function findKnowledgeStorylineCandidates(
  anchors: readonly string[],
  db: KnowledgeDb,
): Promise<{ storylines: KnowledgeStorylineSnapshot[] }> {
  if (anchors.length === 0) {
    return { storylines: [] };
  }

  const matches = await db.storylineAnchor.findMany({
    where: { anchor: { in: [...anchors] } },
    select: { storylineId: true },
    distinct: ["storylineId"],
    take: KNOWLEDGE_CANDIDATE_STORYLINE_MAX,
  });
  const storylineIds = matches.map((match) => match.storylineId);
  if (storylineIds.length === 0) {
    return { storylines: [] };
  }

  const rows = await db.storyline.findMany({
    where: { id: { in: storylineIds }, kind: "story" },
    select: {
      id: true,
      locked: true,
      anchors: { select: { anchor: true } },
      _count: { select: { tickers: true } },
      developments: {
        select: {
          id: true,
          observedAt: true,
          anchors: { select: { anchor: true, fromTitle: true } },
        },
      },
    },
  });

  const storylines = rows.map((row) => ({
    id: row.id,
    anchors: row.anchors.map((entry) => entry.anchor),
    tickerCount: row._count.tickers,
    locked: row.locked,
    developments: row.developments.map((development) => ({
      id: development.id,
      anchors: development.anchors
        .filter((entry) => !entry.fromTitle)
        .map((entry) => entry.anchor),
      titleAnchors: development.anchors
        .filter((entry) => entry.fromTitle)
        .map((entry) => entry.anchor),
      figures: [] as string[],
      day: dayOf(development.observedAt),
    })),
  }));

  return { storylines };
}

const linkTickers = async (
  storylineId: string,
  tickerIds: readonly string[],
  db: KnowledgeDb,
): Promise<void> => {
  if (tickerIds.length === 0) {
    return;
  }
  await db.storylineTicker.createMany({
    data: [...new Set(tickerIds)].map((tickerId) => ({
      storylineId,
      tickerId,
      source: "placement" as const,
    })),
    skipDuplicates: true,
  });
};

const writeDevelopmentAnchors = async (
  developmentId: string,
  anchors: readonly string[],
  titleAnchors: readonly string[],
  db: KnowledgeDb,
): Promise<void> => {
  const titleSet = new Set(titleAnchors);
  const rows = [...new Set([...anchors, ...titleAnchors])].map((anchor) => ({
    developmentId,
    anchor,
    fromTitle: titleSet.has(anchor),
  }));
  if (rows.length > 0) {
    await db.developmentAnchor.createMany({ data: rows, skipDuplicates: true });
  }
};

const growStorylineAnchors = async (
  storylineId: string,
  anchors: readonly string[],
  db: KnowledgeDb,
): Promise<void> => {
  const rows = [...new Set(anchors)].map((anchor) => ({
    storylineId,
    anchor,
  }));
  if (rows.length > 0) {
    await db.storylineAnchor.createMany({ data: rows, skipDuplicates: true });
  }
};

/**
 * Applies the ceiling after a write and locks the Storyline when it has grown past either bound.
 */
const enforceCeiling = async (
  storylineId: string,
  developmentId: string | null,
  db: KnowledgeDb,
): Promise<KnowledgeWriteResult> => {
  const [tickerCount, developmentCount] = await Promise.all([
    db.storylineTicker.count({ where: { storylineId } }),
    db.development.count({ where: { storylineId } }),
  ]);
  const reason = knowledgeLockReason(tickerCount, developmentCount);
  if (reason === null) {
    return { storylineId, developmentId, locked: false, lockedReason: null };
  }

  await db.storyline.update({
    where: { id: storylineId },
    data: { locked: true, lockedReason: reason, lockedAt: new Date() },
  });

  return { storylineId, developmentId, locked: true, lockedReason: reason };
};

/**
 * Opens a Storyline and its first Development from one article.
 *
 * @param body - The article and the anchors describing it.
 * @param db - Prisma delegates.
 */
export async function openKnowledgeStoryline(
  body: PostKnowledgeStorylinesBody,
  db: KnowledgeDb,
): Promise<KnowledgeWriteResult> {
  const observedAt = new Date(body.observedAt);
  const storyline = await db.storyline.create({
    data: {
      name: body.name,
      firstObservedAt: observedAt,
      lastObservedAt: observedAt,
    },
    select: { id: true },
  });

  const development = await db.development.create({
    data: {
      storylineId: storyline.id,
      title: body.title,
      observedAt,
      ingestionRunId: body.ingestionRunId,
    },
    select: { id: true },
  });

  await db.developmentCitation.create({
    data: { developmentId: development.id, dataSourceId: body.dataSourceId },
  });
  await writeDevelopmentAnchors(
    development.id,
    body.anchors,
    body.titleAnchors,
    db,
  );
  await growStorylineAnchors(storyline.id, body.anchors, db);
  await linkTickers(storyline.id, body.tickerIds, db);

  return enforceCeiling(storyline.id, development.id, db);
}

/**
 * Records the next move on an existing Storyline.
 *
 * @param body - The article, its anchors, and the evidence that attached it.
 * @param db - Prisma delegates.
 */
export async function openKnowledgeDevelopment(
  body: PostKnowledgeDevelopmentsBody,
  db: KnowledgeDb,
): Promise<KnowledgeWriteResult> {
  const observedAt = new Date(body.observedAt);
  const development = await db.development.create({
    data: {
      storylineId: body.storylineId,
      title: body.title,
      observedAt,
      ingestionRunId: body.ingestionRunId,
      attachEvidence: body.evidence,
    },
    select: { id: true },
  });

  await db.developmentCitation.create({
    data: { developmentId: development.id, dataSourceId: body.dataSourceId },
  });
  await writeDevelopmentAnchors(
    development.id,
    body.anchors,
    body.titleAnchors,
    db,
  );
  await growStorylineAnchors(body.storylineId, body.anchors, db);
  await linkTickers(body.storylineId, body.tickerIds, db);
  await db.storyline.update({
    where: { id: body.storylineId },
    data: { lastObservedAt: observedAt },
  });

  return enforceCeiling(body.storylineId, development.id, db);
}

/**
 * Adds one more reporting Data Source to a move already recorded.
 *
 * @param body - The article and the Development it reports.
 * @param db - Prisma delegates.
 */
export async function citeKnowledgeDevelopment(
  body: PostKnowledgeDevelopmentCitationsBody,
  db: KnowledgeDb,
): Promise<KnowledgeWriteResult> {
  await db.developmentCitation.createMany({
    data: [
      { developmentId: body.developmentId, dataSourceId: body.dataSourceId },
    ],
    skipDuplicates: true,
  });
  await writeDevelopmentAnchors(body.developmentId, body.anchors, [], db);
  await growStorylineAnchors(body.storylineId, body.anchors, db);
  await linkTickers(body.storylineId, body.tickerIds, db);
  await db.storyline.update({
    where: { id: body.storylineId },
    data: { lastObservedAt: new Date(body.observedAt) },
  });

  return enforceCeiling(body.storylineId, body.developmentId, db);
}

/**
 * Opens the chronicle row for one ingestion run.
 *
 * @param body - Run identity and start time.
 * @param db - Prisma delegates.
 */
export async function startKnowledgeIngestionRun(
  body: PostKnowledgeIngestionRunsBody,
  db: KnowledgeDb,
): Promise<{ ingestionRunId: string }> {
  const run = await db.knowledgeIngestionRun.create({
    data: {
      scheduleExecutionId: body.scheduleExecutionId,
      agentVersion: body.agentVersion,
      startedAt: new Date(body.startedAt),
      status: "running",
    },
    select: { id: true },
  });

  return { ingestionRunId: run.id };
}

/**
 * Closes an ingestion run with its counters.
 *
 * @param body - Terminal status, watermark and counters.
 * @param db - Prisma delegates.
 */
export async function finishKnowledgeIngestionRun(
  body: PostKnowledgeIngestionRunsFinishBody,
  db: KnowledgeDb,
): Promise<void> {
  await db.knowledgeIngestionRun.update({
    where: { id: body.ingestionRunId },
    data: {
      status: body.status,
      completedAt: new Date(body.completedAt),
      watermarkAt:
        body.watermarkAt === null ? null : new Date(body.watermarkAt),
      considered: body.considered,
      storylinesOpened: body.storylinesOpened,
      developmentsOpened: body.developmentsOpened,
      citationsAdded: body.citationsAdded,
      storylinesLocked: body.storylinesLocked,
      skippedNoAnchors: body.skippedNoAnchors,
      stopReason: body.stopReason,
      durationMs: body.durationMs,
    },
  });
}
