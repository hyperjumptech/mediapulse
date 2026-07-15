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

/** Prisma collaborator surface for {@link findActiveQuerySetForNewsletter}. */
type SearchQuerySetDelegate = Pick<typeof prisma.searchQuerySet, "findFirst">;

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

/**
 * Finds the SearchQuerySet that was active when the newsletter was generated: the most recent set
 * generated on or before the newsletter's `createdAt`, regardless of the current `isActive` flag.
 * This is a point-in-time snapshot, so a later query-analysis run that activates a new set does not
 * change what an old newsletter shows. Returns `null` when no set predates the newsletter.
 *
 * @param tickerId - Ticker the newsletter belongs to.
 * @param createdAt - Newsletter's `createdAt` (acts as upper bound for `generatedAt`).
 * @param deps - Prisma `searchQuerySet` delegate (defaults to the global client when wired by the route).
 * @returns The set that was active at generation time with its queries, or `null`.
 */
export const findActiveQuerySetForNewsletter = async (
  tickerId: string,
  createdAt: Date,
  deps: { searchQuerySet: SearchQuerySetDelegate },
): Promise<ActiveQuerySetPayload> => {
  const findFirstArgs = {
    where: {
      tickerId,
      generatedAt: { lte: createdAt },
    },
    include: {
      searchQueries: {
        orderBy: [{ rank: "asc" as const }, { createdAt: "asc" as const }],
      },
    },
    orderBy: { generatedAt: "desc" as const },
  } satisfies Prisma.SearchQuerySetFindFirstArgs;

  const set = await deps.searchQuerySet.findFirst(findFirstArgs);
  if (!set) {
    return null;
  }

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

  return {
    setId: set.id,
    generatedAt: set.generatedAt.toISOString(),
    generationSource: set.generationSource,
    agentLabel,
    generatedAtLabel: formatGeneratedAt(set.generatedAt),
    model,
    tokensTotalLabel: compactNumber(totalTokens),
    tokensBreakdownLabel: `Input ${promptTokens.toLocaleString("en-US")} · Output ${completionTokens.toLocaleString("en-US")} · Reasoning ${reasoningTokens.toLocaleString("en-US")}`,
    queries: set.searchQueries.map((query) => ({
      id: query.id,
      text: query.text,
      intent: query.intent,
      rank: query.rank,
    })),
  };
};
