/**
 * Shared Prisma helpers for creating, updating, and deleting versioned search query sets.
 */

import { prisma, type Prisma } from "@mediapulse/database";
import type { QueryAnalysisIntent } from "@workspace/agent-data-api-contract";

/** One query row supplied when creating or replacing set membership. */
export type SearchQuerySetPersistQueryInput = {
  text: string;
  intent: QueryAnalysisIntent;
  rank: number;
};

/** Input for creating a search query set with nested queries. */
export type CreateSearchQuerySetInput = {
  tickerId: string;
  isActive: boolean;
  generationSource: string;
  strategySnapshot: Record<string, unknown>;
  agentJobId?: string;
  generatedAt?: Date;
  queries: SearchQuerySetPersistQueryInput[];
};

/** Scalar fields updatable on an existing set (queries replaced separately). */
export type UpdateSearchQuerySetScalars = {
  isActive?: boolean;
  generationSource?: string;
  strategySnapshot?: Record<string, unknown>;
  agentJobId?: string | null;
};

type SearchQuerySetPersistDb = {
  searchQuerySet: Pick<
    typeof prisma.searchQuerySet,
    "updateMany" | "create" | "update" | "findUnique" | "delete"
  >;
  searchQuery: Pick<typeof prisma.searchQuery, "deleteMany" | "createMany">;
};

const defaultDb: SearchQuerySetPersistDb = {
  searchQuerySet: prisma.searchQuerySet,
  searchQuery: prisma.searchQuery,
};

/**
 * Returns an error message when duplicate query texts appear in one payload.
 *
 * @param queries - Query rows to validate.
 * @returns Message when invalid, otherwise `null`.
 */
export const findDuplicateQueryTexts = (
  queries: SearchQuerySetPersistQueryInput[],
): string | null => {
  const seen = new Set<string>();
  for (const query of queries) {
    const key = query.text.trim();
    if (seen.has(key)) {
      return `Duplicate query text in set: "${key}"`;
    }
    seen.add(key);
  }
  return null;
};

/**
 * Deactivates all active sets for a ticker (used before activating a new set).
 *
 * @param tickerId - Ticker owning the sets.
 * @param db - Optional injected DB delegates for testing.
 */
export const deactivateActiveSetsForTicker = async (
  tickerId: string,
  db: SearchQuerySetPersistDb = defaultDb,
): Promise<void> => {
  await db.searchQuerySet.updateMany({
    where: { tickerId, isActive: true },
    data: { isActive: false },
  } satisfies Prisma.SearchQuerySetUpdateManyArgs);
};

/**
 * Creates a search query set with nested queries. Deactivates other active sets when `isActive` is true.
 *
 * @param input - Set metadata and query rows.
 * @param db - Optional injected DB delegates for testing.
 * @returns Created set id.
 */
export const createSearchQuerySet = async (
  input: CreateSearchQuerySetInput,
  db: SearchQuerySetPersistDb = defaultDb,
): Promise<{ id: string; queryCount: number }> => {
  const duplicate = findDuplicateQueryTexts(input.queries);
  if (duplicate) {
    throw new SearchQuerySetPersistError(duplicate);
  }

  if (input.isActive) {
    await deactivateActiveSetsForTicker(input.tickerId, db);
  }

  const createdSet = await db.searchQuerySet.create({
    data: {
      tickerId: input.tickerId,
      isActive: input.isActive,
      generatedAt: input.generatedAt ?? new Date(),
      generationSource: input.generationSource,
      strategySnapshot: input.strategySnapshot as Prisma.InputJsonObject,
      agentJobId: input.agentJobId,
      searchQueries: {
        create: input.queries.map((query) => ({
          tickerId: input.tickerId,
          text: query.text,
          intent: query.intent,
          rank: query.rank,
        })),
      },
    },
  } satisfies Prisma.SearchQuerySetCreateArgs);

  return { id: createdSet.id, queryCount: input.queries.length };
};

/**
 * Replaces all queries belonging to a set (delete then recreate).
 *
 * @param setId - Set id.
 * @param tickerId - Ticker id for child rows.
 * @param queries - New query rows.
 * @param db - Optional injected DB delegates for testing.
 */
export const replaceSearchQueriesForSet = async (
  setId: string,
  tickerId: string,
  queries: SearchQuerySetPersistQueryInput[],
  db: SearchQuerySetPersistDb = defaultDb,
): Promise<void> => {
  const duplicate = findDuplicateQueryTexts(queries);
  if (duplicate) {
    throw new SearchQuerySetPersistError(duplicate);
  }

  await db.searchQuery.deleteMany({
    where: { setId },
  } satisfies Prisma.SearchQueryDeleteManyArgs);

  if (queries.length === 0) {
    return;
  }

  await db.searchQuery.createMany({
    data: queries.map((query) => ({
      setId,
      tickerId,
      text: query.text,
      intent: query.intent,
      rank: query.rank,
    })),
  } satisfies Prisma.SearchQueryCreateManyArgs);
};

/**
 * Updates scalar fields on a set and optionally replaces queries. Handles `isActive` activation.
 *
 * @param id - Set id.
 * @param patch - Scalar updates and optional query replacement.
 * @param db - Optional injected DB delegates for testing.
 * @returns Updated set id.
 */
export const updateSearchQuerySet = async (
  id: string,
  patch: UpdateSearchQuerySetScalars & {
    queries?: SearchQuerySetPersistQueryInput[];
  },
  db: SearchQuerySetPersistDb = defaultDb,
): Promise<{ id: string }> => {
  const existing = await db.searchQuerySet.findUnique({
    where: { id },
    select: { id: true, tickerId: true, isActive: true },
  } satisfies Prisma.SearchQuerySetFindUniqueArgs);

  if (!existing) {
    throw new SearchQuerySetPersistError("Search query set not found", 404);
  }

  if (patch.isActive === true && !existing.isActive) {
    await deactivateActiveSetsForTicker(existing.tickerId, db);
  }

  const data: Prisma.SearchQuerySetUpdateInput = {};
  if (patch.isActive !== undefined) {
    data.isActive = patch.isActive;
  }
  if (patch.generationSource !== undefined) {
    data.generationSource = patch.generationSource;
  }
  if (patch.strategySnapshot !== undefined) {
    data.strategySnapshot = patch.strategySnapshot as Prisma.InputJsonObject;
  }
  if (patch.agentJobId !== undefined) {
    data.agentJobId = patch.agentJobId;
  }

  const updated = await db.searchQuerySet.update({
    where: { id },
    data,
  } satisfies Prisma.SearchQuerySetUpdateArgs);

  if (patch.queries !== undefined) {
    await replaceSearchQueriesForSet(id, existing.tickerId, patch.queries, db);
  }

  return { id: updated.id };
};

/**
 * Deletes a set and all child search queries.
 *
 * @param id - Set id.
 * @param db - Optional injected DB delegates for testing.
 */
export const deleteSearchQuerySet = async (
  id: string,
  db: SearchQuerySetPersistDb = defaultDb,
): Promise<void> => {
  const existing = await db.searchQuerySet.findUnique({
    where: { id },
    select: { id: true },
  } satisfies Prisma.SearchQuerySetFindUniqueArgs);

  if (!existing) {
    throw new SearchQuerySetPersistError("Search query set not found", 404);
  }

  await db.searchQuery.deleteMany({
    where: { setId: id },
  } satisfies Prisma.SearchQueryDeleteManyArgs);

  await db.searchQuerySet.delete({
    where: { id },
  } satisfies Prisma.SearchQuerySetDeleteArgs);
};

/** Persist-layer validation or not-found error with optional HTTP status. */
export class SearchQuerySetPersistError extends Error {
  /** HTTP status code for API handlers (defaults to 400). */
  readonly status: 400 | 404;

  /**
   * @param message - Error message for clients.
   * @param status - HTTP status (400 or 404).
   */
  constructor(message: string, status: 400 | 404 = 400) {
    super(message);
    this.name = "SearchQuerySetPersistError";
    this.status = status;
  }
}
