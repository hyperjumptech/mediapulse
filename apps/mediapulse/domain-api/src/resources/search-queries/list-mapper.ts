/**
 * Prisma `include` for search-query list rows and mapper from joined query+ticker+set to list items.
 */

import type { Prisma } from "@mediapulse/database";

/**
 * `include` passed to `searchQuery.findMany` for the list endpoint.
 * Single definition for both the route query and {@link ListRow}.
 */
export const listInclude = {
  ticker: {
    select: {
      symbol: true,
      name: true,
    },
  },
  set: {
    select: {
      id: true,
      isActive: true,
      generatedAt: true,
      generationSource: true,
      agentJobId: true,
    },
  },
} satisfies Prisma.SearchQueryInclude;

/**
 * Prisma row shape for `searchQuery.findMany` when loading the list view.
 */
export type ListRow = Prisma.SearchQueryGetPayload<{
  include: typeof listInclude;
}>;

const sourceLabel = (source: ListRow["source"]): string => {
  if (source === "DETERMINISTIC") return "Deterministic";
  if (source === "LLM") return "LLM";
  return "";
};

const intentLabel = (intent: ListRow["intent"]): string => {
  if (intent === "BREAKING") return "Breaking";
  if (intent === "KG_CHANGE") return "KG Change";
  if (intent === "FUNDAMENTAL") return "Fundamental";
  return "";
};

/**
 * Maps a search-query row (with ticker, symbol, name and set) to the JSON list item.
 *
 * @param row - Row from `prisma.searchQuery.findMany` using {@link listInclude}.
 * @returns Serializable list row for the domain API.
 */
export const mapRowToListItem = (row: ListRow) => ({
  id: row.id,
  text: row.text,
  tickerSymbol: row.ticker.symbol,
  tickerName: row.ticker.name,
  activeSet: row.set?.isActive ? "Yes" : "No",
  intent: intentLabel(row.intent),
  rank: row.rank !== null && row.rank !== undefined ? String(row.rank) : "",
  source: sourceLabel(row.source),
  setGeneratedAt: row.set?.generatedAt?.toISOString() ?? null,
  generationPipeline: row.set?.generationSource ?? "",
  querySetId: row.set?.id ?? "",
  agentJobId: row.set?.agentJobId ?? "",
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** JSON list item type; derived from {@link mapRowToListItem}. */
export type ListItem = ReturnType<typeof mapRowToListItem>;
