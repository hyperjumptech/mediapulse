import type { Prisma, prisma } from "@mediapulse/database";

import {
  classifyCollectionSource,
  COLLECTION_SOURCE_LABEL,
} from "../data-sources/collection-source";

const STAGE_TIMEZONE = "Asia/Jakarta";

/** Label shown in the Query column for sources that did not come from a search query. */
export const CURATED_SOURCE_LABEL = "Curated source" as const;

/** Shape of one collected-source row in the Collected results tab. */
export type SourceCollectionEntryPayload = {
  id: string;
  title: string;
  url: string;
  agentLine: string;
  queryText: string;
};

/** Shape of one dropped/failed URL row in the Dropped results tab. */
export type SourceCollectionDroppedPayload = {
  id: string;
  url: string;
  agentLine: string;
  reason: string;
  reasonDetail: string;
};

/** Shape of the source-collection stage payload exposed by the detail handler. */
export type SourceCollectionPayload = {
  generatedAtLabel: string;
  creditsTotalLabel: string;
  creditsBreakdownLabel: string;
  collectedTotalLabel: string;
  droppedTotalLabel: string;
  sources: SourceCollectionEntryPayload[];
  dropped: SourceCollectionDroppedPayload[];
};

/** Prisma collaborator surface for {@link buildSourceCollection}. */
export type BuildSourceCollectionDeps = {
  newsletterCitation: Pick<typeof prisma.newsletterCitation, "findMany">;
  dataCollectionRun: Pick<typeof prisma.dataCollectionRun, "findMany">;
  collectionUrlOutcome: Pick<typeof prisma.collectionUrlOutcome, "findMany">;
};

type RunFields = {
  agentVersion: string | null;
  searchCredits: number;
  searchCreditsByProvider: Record<string, number>;
};

const toRecordOfNumbers = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "number" && Number.isFinite(entry)) {
      result[key] = entry;
    }
  }

  return result;
};

const readRunSnapshot = (snapshot: Prisma.JsonValue | null): RunFields => {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return {
      agentVersion: null,
      searchCredits: 0,
      searchCreditsByProvider: {},
    };
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
    agentVersion:
      typeof record.agentVersion === "string" ? record.agentVersion : null,
    searchCredits,
    searchCreditsByProvider: toRecordOfNumbers(cost?.searchCreditsByProvider),
  };
};

const providerLabel = (provider: string): string =>
  provider.length > 0
    ? `${provider[0]!.toUpperCase()}${provider.slice(1)}`
    : provider;

const outcomeAgentLabel = (agent: string): string =>
  agent === "page_collection"
    ? COLLECTION_SOURCE_LABEL["page-collection"]
    : COLLECTION_SOURCE_LABEL["data-collection"];

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
 * cited sources (the Collected tab), the URLs the same runs dropped or failed (the Dropped tab, via
 * `CollectionUrlOutcome` scoped to those runs), and the runs' timing and search-credit spend. Runs
 * are traced through each cited source's `dataCollectionRunId`, so every figure is scoped to the exact
 * runs behind this newsletter rather than the ticker's wider collection funnel. Each Agent label
 * carries the collecting agent's version, read from the run snapshot.
 *
 * @param newsletterId - Newsletter whose cited sources to collect.
 * @param deps - Prisma `newsletterCitation`, `dataCollectionRun`, and `collectionUrlOutcome` delegates.
 * @returns The stage KPIs, the collected sources, and the dropped URLs.
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

  const runIds = [
    ...new Set(
      dataSources
        .map((dataSource) => dataSource.dataCollectionRunId)
        .filter((runId): runId is string => runId !== null),
    ),
  ];

  const [runs, droppedRows] =
    runIds.length > 0
      ? await Promise.all([
          deps.dataCollectionRun.findMany({
            where: { id: { in: runIds } },
            select: {
              id: true,
              startedAt: true,
              completedAt: true,
              snapshot: true,
            },
          } satisfies Prisma.DataCollectionRunFindManyArgs),
          deps.collectionUrlOutcome.findMany({
            where: {
              runId: { in: runIds },
              status: { in: ["dropped", "failed"] },
            },
            select: {
              id: true,
              url: true,
              runId: true,
              agent: true,
              reason: true,
              reasonDetail: true,
            },
            orderBy: { createdAt: "desc" },
          } satisfies Prisma.CollectionUrlOutcomeFindManyArgs),
        ])
      : [[], []];

  const versionByRunId = new Map<string, string>();
  const creditsByProvider = new Map<string, number>();
  let totalCredits = 0;
  let latestRunAt: Date | null = null;

  for (const run of runs) {
    const { agentVersion, searchCredits, searchCreditsByProvider } =
      readRunSnapshot(run.snapshot);
    if (agentVersion) versionByRunId.set(run.id, agentVersion);
    totalCredits += searchCredits;
    for (const [provider, credits] of Object.entries(searchCreditsByProvider)) {
      creditsByProvider.set(
        provider,
        (creditsByProvider.get(provider) ?? 0) + credits,
      );
    }

    const runAt = run.completedAt ?? run.startedAt;
    if (latestRunAt === null || runAt.getTime() > latestRunAt.getTime()) {
      latestRunAt = runAt;
    }
  }

  const agentLine = (label: string, runId: string | null): string => {
    const version = runId ? versionByRunId.get(runId) : undefined;
    return version ? `From ${label} ${version}` : `From ${label}`;
  };

  const sources = dataSources.map((dataSource) => {
    const collectionSource = classifyCollectionSource(
      dataSource.searchQueryId !== null,
    );

    return {
      id: dataSource.id,
      title: dataSource.title,
      url: dataSource.url,
      agentLine: agentLine(
        COLLECTION_SOURCE_LABEL[collectionSource],
        dataSource.dataCollectionRunId,
      ),
      queryText:
        dataSource.searchQuery?.text ??
        (collectionSource === "page-collection" ? CURATED_SOURCE_LABEL : "—"),
    } satisfies SourceCollectionEntryPayload;
  });
  sources.sort((left, right) => {
    if (left.agentLine !== right.agentLine) {
      return left.agentLine.localeCompare(right.agentLine);
    }

    return left.title.localeCompare(right.title);
  });

  const dropped = droppedRows.map((outcome) => ({
    id: outcome.id,
    url: outcome.url,
    agentLine: agentLine(outcomeAgentLabel(outcome.agent), outcome.runId),
    reason: outcome.reason ?? "—",
    reasonDetail: outcome.reasonDetail ?? "",
  }));

  const creditsBreakdownLabel =
    creditsByProvider.size > 0
      ? [...creditsByProvider.entries()]
          .sort(([leftProvider], [rightProvider]) =>
            leftProvider.localeCompare(rightProvider),
          )
          .map(
            ([provider, credits]) =>
              `${providerLabel(provider)} ${credits.toLocaleString("en-US")}`,
          )
          .join(" · ")
      : "No cost recorded";

  return {
    generatedAtLabel: latestRunAt ? formatGeneratedAt(latestRunAt) : "—",
    creditsTotalLabel: totalCredits.toLocaleString("en-US"),
    creditsBreakdownLabel,
    collectedTotalLabel: sources.length.toLocaleString("en-US"),
    droppedTotalLabel: dropped.length.toLocaleString("en-US"),
    sources,
    dropped,
  };
};
