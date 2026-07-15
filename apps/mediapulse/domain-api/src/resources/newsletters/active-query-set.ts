import type { Prisma, prisma } from "@mediapulse/database";

/** Shape of one active-query-set entry exposed by the detail handler. */
export type ActiveQuerySetPayload = {
  setId: string;
  generatedAt: string;
  generationSource: string;
  agentLabel: string;
  generatedAtLabel: string;
  model: string;
  tokensTotalLabel: string;
  tokensBreakdownLabel: string;
  queries: Array<{
    id: string;
    text: string;
    intent: string;
    rank: number;
  }>;
} | null;

/** Prisma collaborator surface for {@link findQuerySetForNewsletter}. */
type SearchQuerySetDelegate = Pick<typeof prisma.searchQuerySet, "findUnique">;

type QuerySetRow = Prisma.SearchQuerySetGetPayload<{
  include: { searchQueries: true };
}>;

const STAGE_TIMEZONE = "Asia/Jakarta";

const toFiniteNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const compactNumber = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

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

const toQuerySetPayload = (
  set: QuerySetRow,
): NonNullable<ActiveQuerySetPayload> => {
  const agentName = set.agentId ?? "query-analysis";
  const agentLabel = set.agentVersion
    ? `${agentName} - ${set.agentVersion}`
    : agentName;

  const llmUsage =
    (set.strategySnapshot as { llmUsage?: Record<string, unknown> } | null)
      ?.llmUsage ?? {};
  const model =
    typeof llmUsage.model === "string" && llmUsage.model.length > 0
      ? llmUsage.model
      : "—";
  const promptTokens = toFiniteNumber(llmUsage.promptTokens);
  const completionTokens = toFiniteNumber(llmUsage.completionTokens);
  const reasoningTokens = toFiniteNumber(llmUsage.reasoningTokens);
  const totalTokens =
    toFiniteNumber(llmUsage.totalTokens) ||
    promptTokens + completionTokens + reasoningTokens;

  const sortedQueries = [...set.searchQueries].sort((left, right) => {
    if (left.rank !== right.rank) return left.rank - right.rank;
    return left.createdAt.getTime() - right.createdAt.getTime();
  });

  return {
    setId: set.id,
    generatedAt: set.generatedAt.toISOString(),
    generationSource: set.generationSource,
    agentLabel,
    generatedAtLabel: formatGeneratedAt(set.generatedAt),
    model,
    tokensTotalLabel: compactNumber(totalTokens),
    tokensBreakdownLabel: `Input ${promptTokens.toLocaleString("en-US")} · Output ${completionTokens.toLocaleString("en-US")} · Reasoning ${reasoningTokens.toLocaleString("en-US")}`,
    queries: sortedQueries.map((query) => ({
      id: query.id,
      text: query.text,
      intent: query.intent,
      rank: query.rank,
    })),
  };
};

/**
 * Loads the exact SearchQuerySet a newsletter was generated from, via the newsletter's
 * `searchQuerySetId` hard link. Returns `null` when the newsletter has no linked set (older
 * newsletters that predate the column, or a set since deleted) — the detail page then shows its
 * empty state rather than inferring a different set.
 *
 * @param searchQuerySetId - The newsletter's linked set id, or `null`.
 * @param deps - Prisma `searchQuerySet` delegate.
 * @returns The linked set with its queries, or `null`.
 */
export const findQuerySetForNewsletter = async (
  searchQuerySetId: string | null,
  deps: { searchQuerySet: SearchQuerySetDelegate },
): Promise<ActiveQuerySetPayload> => {
  if (searchQuerySetId === null) {
    return null;
  }

  const set = await deps.searchQuerySet.findUnique({
    where: { id: searchQuerySetId },
    include: { searchQueries: true },
  } satisfies Prisma.SearchQuerySetFindUniqueArgs);

  return set ? toQuerySetPayload(set) : null;
};
