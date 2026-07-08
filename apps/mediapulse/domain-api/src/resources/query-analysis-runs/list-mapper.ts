import type { Prisma } from "@mediapulse/database";
import { queryDecisionSchema } from "@workspace/agent-data-api-contract";
import { z } from "zod";

const queryDecisionsSchema = z.array(queryDecisionSchema);

/** Row shape for the query-analysis run list (ticker symbol joined). */
export type QueryAnalysisRunListRow = Prisma.QueryAnalysisRunGetPayload<{
  include: { ticker: { select: { symbol: true } } };
}>;

export type ListItem = {
  id: string;
  createdAt: string;
  tickerSymbol: string;
  generated: number;
  included: number;
  rejected: number;
  executionId: string | null;
};

export type DetailItem = ListItem & {
  tickerId: string;
  /** Pretty-printed per-query decisions: [{ text, included, reason }]. */
  decisionsJson: string;
};

/** Parses the stored `queries` JSON into decisions and derives the summary counts. */
function summarizeDecisions(queries: Prisma.JsonValue): {
  decisions: z.infer<typeof queryDecisionsSchema>;
  generated: number;
  included: number;
  rejected: number;
} {
  const parsed = queryDecisionsSchema.safeParse(queries);
  const decisions = parsed.success ? parsed.data : [];
  const included = decisions.filter((decision) => decision.included).length;

  return {
    decisions,
    generated: decisions.length,
    included,
    rejected: decisions.length - included,
  };
}

export const listInclude = {
  ticker: { select: { symbol: true } },
} satisfies Prisma.QueryAnalysisRunInclude;

/**
 * Maps a Prisma query-analysis run row to a table-v1 list item (counts derived from `queries`).
 *
 * @param row - Run with ticker relation.
 */
export function mapRowToListItem(row: QueryAnalysisRunListRow): ListItem {
  const { generated, included, rejected } = summarizeDecisions(row.queries);

  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    tickerSymbol: row.ticker.symbol,
    generated,
    included,
    rejected,
    executionId: row.executionId,
  };
}

/**
 * Maps a run to a Hermes detail payload with the full per-query decision list as JSON text.
 *
 * @param row - Run with ticker relation.
 */
export function mapRowToDetailItem(row: QueryAnalysisRunListRow): DetailItem {
  const base = mapRowToListItem(row);
  const { decisions } = summarizeDecisions(row.queries);

  return {
    ...base,
    tickerId: row.tickerId,
    decisionsJson: JSON.stringify(decisions, null, 2),
  };
}
