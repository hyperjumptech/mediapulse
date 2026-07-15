import type { Prisma, prisma } from "@mediapulse/database";

import {
  classifyCollectionSource,
  COLLECTION_SOURCE_LABEL,
  type CollectionSource,
} from "../data-sources/collection-source";

const STAGE_TIMEZONE = "Asia/Jakarta";

/** Label shown in the Query column for sources that did not come from a search query. */
export const CURATED_SOURCE_LABEL = "Curated source" as const;

/** Shape of one collected-source row in the source-collection stage results table. */
export type SourceCollectionEntryPayload = {
  id: string;
  title: string;
  url: string;
  agentLabel: string;
  queryText: string;
};

/** Shape of the source-collection stage payload exposed by the detail handler. */
export type SourceCollectionPayload = {
  agentsLabel: string;
  generatedAtLabel: string;
  creditsTotalLabel: string;
  creditsBreakdownLabel: string;
  totalLabel: string;
  sources: SourceCollectionEntryPayload[];
};

/** Prisma collaborator surface for {@link buildSourceCollection}. */
export type BuildSourceCollectionDeps = {
  newsletterCitation: Pick<typeof prisma.newsletterCitation, "findMany">;
  dataCollectionRun: Pick<typeof prisma.dataCollectionRun, "findMany">;
};

type RunFields = {
  agentId: string | null;
  agentVersion: string | null;
  searchCredits: number;
};

const readRunSnapshot = (snapshot: Prisma.JsonValue | null): RunFields => {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return { agentId: null, agentVersion: null, searchCredits: 0 };
  }
  const record = snapshot as Record<string, unknown>;
  const cost =
    record.cost &&
    typeof record.cost === "object" &&
    !Array.isArray(record.cost)
      ? (record.cost as Record<string, unknown>)
      : null;
  const searchCredits =
    cost &&
    typeof cost.searchCredits === "number" &&
    Number.isFinite(cost.searchCredits)
      ? cost.searchCredits
      : 0;

  return {
    agentId: typeof record.agentId === "string" ? record.agentId : null,
    agentVersion:
      typeof record.agentVersion === "string" ? record.agentVersion : null,
    searchCredits,
  };
};

const agentLabel = (agentId: string, agentVersion: string | null): string =>
  agentVersion ? `${agentId} - ${agentVersion}` : agentId;

const collectorLabel = (agentId: string): string =>
  agentId in COLLECTION_SOURCE_LABEL
    ? COLLECTION_SOURCE_LABEL[agentId as CollectionSource]
    : agentId;

const formatGeneratedAt = (date: Date): string => {
  const datePart = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: STAGE_TIMEZONE,
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: STAGE_TIMEZONE,
  }).format(date);

  return `${datePart} at ${timePart}`;
};

/**
 * Assembles the source-collection stage for a newsletter from its exact citation join: the distinct
 * cited sources, and the collection runs that produced them (traced via each source's
 * `dataCollectionRunId`). KPIs cover the agents and versions that collected them, when they ran, the
 * search credits those runs spent, and the total cited-source count. Every figure is scoped to the
 * sources this newsletter actually cited rather than the ticker's wider collection funnel.
 *
 * @param newsletterId - Newsletter whose cited sources to collect.
 * @param deps - Prisma `newsletterCitation` and `dataCollectionRun` delegates.
 * @returns The stage KPIs and the ordered list of cited sources.
 */
export const buildSourceCollection = async (
  newsletterId: string,
  deps: BuildSourceCollectionDeps,
): Promise<SourceCollectionPayload> => {
  const findManyArgs = {
    where: { newsletterId },
    include: {
      dataSource: {
        select: {
          id: true,
          url: true,
          title: true,
          searchQueryId: true,
          dataCollectionRunId: true,
          searchQuery: { select: { text: true } },
        },
      },
    },
  } satisfies Prisma.NewsletterCitationFindManyArgs;

  const rows = await deps.newsletterCitation.findMany(findManyArgs);

  type CitationRow = Prisma.NewsletterCitationGetPayload<typeof findManyArgs>;

  const uniqueSources = new Map<string, CitationRow["dataSource"]>();
  for (const row of rows as CitationRow[]) {
    if (!uniqueSources.has(row.dataSource.id)) {
      uniqueSources.set(row.dataSource.id, row.dataSource);
    }
  }
  const dataSources = [...uniqueSources.values()];

  const sources = dataSources.map((dataSource) => {
    const collectionSource = classifyCollectionSource(
      dataSource.searchQueryId !== null,
    );

    return {
      id: dataSource.id,
      title: dataSource.title,
      url: dataSource.url,
      agentLabel: COLLECTION_SOURCE_LABEL[collectionSource],
      queryText:
        dataSource.searchQuery?.text ??
        (collectionSource === "page-collection" ? CURATED_SOURCE_LABEL : "—"),
    } satisfies SourceCollectionEntryPayload;
  });
  sources.sort((left, right) => {
    if (left.agentLabel !== right.agentLabel) {
      return left.agentLabel.localeCompare(right.agentLabel);
    }

    return left.title.localeCompare(right.title);
  });

  const runIds = [
    ...new Set(
      dataSources
        .map((dataSource) => dataSource.dataCollectionRunId)
        .filter((runId): runId is string => runId !== null),
    ),
  ];

  const runs =
    runIds.length > 0
      ? await deps.dataCollectionRun.findMany({
          where: { id: { in: runIds } },
          select: {
            id: true,
            startedAt: true,
            completedAt: true,
            snapshot: true,
          },
        } satisfies Prisma.DataCollectionRunFindManyArgs)
      : [];

  const agentLabels = new Set<string>();
  const creditsByAgent = new Map<string, number>();
  let totalCredits = 0;
  let latestRunAt: Date | null = null;

  for (const run of runs) {
    const { agentId, agentVersion, searchCredits } = readRunSnapshot(
      run.snapshot,
    );
    if (agentId) {
      agentLabels.add(agentLabel(agentId, agentVersion));
      creditsByAgent.set(
        agentId,
        (creditsByAgent.get(agentId) ?? 0) + searchCredits,
      );
    }
    totalCredits += searchCredits;

    const runAt = run.completedAt ?? run.startedAt;
    if (latestRunAt === null || runAt.getTime() > latestRunAt.getTime()) {
      latestRunAt = runAt;
    }
  }

  const agentsLabel =
    agentLabels.size > 0
      ? [...agentLabels].sort().join(" · ")
      : [...new Set(sources.map((source) => source.agentLabel))]
          .sort()
          .join(" · ") || "—";

  const creditsBreakdownLabel =
    creditsByAgent.size > 0
      ? [...creditsByAgent.entries()]
          .sort(([leftAgent], [rightAgent]) =>
            leftAgent.localeCompare(rightAgent),
          )
          .map(
            ([agentId, credits]) =>
              `${collectorLabel(agentId)} ${credits.toLocaleString("en-US")}`,
          )
          .join(" · ")
      : "No cost recorded";

  return {
    agentsLabel,
    generatedAtLabel: latestRunAt ? formatGeneratedAt(latestRunAt) : "—",
    creditsTotalLabel: totalCredits.toLocaleString("en-US"),
    creditsBreakdownLabel,
    totalLabel: sources.length.toLocaleString("en-US"),
    sources,
  };
};
