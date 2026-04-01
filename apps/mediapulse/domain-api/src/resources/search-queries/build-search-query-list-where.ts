import type { Prisma } from "@mediapulse/database";

/**
 * Builds an `OR` clause for free-text search across ticker fields, query text, set id, job id, intent, and source labels.
 *
 * @param query - Trimmed search string from the list `q` parameter.
 * @returns Prisma `OR` list for `SearchQueryWhereInput`, or `undefined` when `query` is empty.
 */
export const buildSearchQueryListOr = (
  query: string,
): Prisma.SearchQueryWhereInput[] | undefined => {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const qlower = trimmed.toLowerCase();

  const or: Prisma.SearchQueryWhereInput[] = [
    { text: { contains: trimmed, mode: "insensitive" as const } },
    {
      ticker: { name: { contains: trimmed, mode: "insensitive" as const } },
    },
    {
      ticker: { symbol: { contains: trimmed, mode: "insensitive" as const } },
    },
    {
      querySet: {
        id: { contains: trimmed, mode: "insensitive" as const },
      },
    },
    {
      querySet: {
        agentJobId: { contains: trimmed, mode: "insensitive" as const },
      },
    },
  ];

  const intents: Array<"breaking" | "kg_change" | "fundamental"> = [];
  if (qlower.includes("break")) {
    intents.push("breaking");
  }
  if (
    qlower.includes("kg") ||
    qlower.includes("graph") ||
    qlower.includes("relation")
  ) {
    intents.push("kg_change");
  }
  if (qlower.includes("fund")) {
    intents.push("fundamental");
  }
  if (intents.length > 0) {
    or.push({ intent: { in: intents } });
  }

  const sources: Array<"deterministic" | "llm"> = [];
  if (qlower.includes("determ")) {
    sources.push("deterministic");
  }
  if (qlower.includes("llm")) {
    sources.push("llm");
  }
  if (sources.length > 0) {
    or.push({ source: { in: sources } });
  }

  return or;
};
