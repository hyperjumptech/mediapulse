/**
 * Declares search-query-sets table-v1 custom actions (manifest rows + Hono handlers).
 */

import type { DashboardPageCustomAction } from "@hermes/domain-contract";
import { prisma } from "@mediapulse/database";
import type { Handler } from "hono";
import { z } from "zod";

import {
  buildResetAllActionManifest,
  isPrismaForeignKeyViolation,
} from "../../lib/table-v1-reset-all-action";

/** Confirm token required in the POST body for reset-all. */
export const searchQuerySetsResetAllConfirmToken =
  "DELETE_ALL_SEARCH_QUERY_SETS" as const;

const searchQuerySetsResetAllBodySchema = z
  .object({
    confirm: z.literal(searchQuerySetsResetAllConfirmToken),
  })
  .strict();

/**
 * Deletes member queries then all search query sets in one flow.
 */
const deleteAllSearchQuerySets = async (): Promise<{ count: number }> => {
  await prisma.searchQuery.deleteMany({
    where: { setId: { not: null } },
  });
  return prisma.searchQuerySet.deleteMany({});
};

/** POST handler for reset-all with FK-safe errors on member query deletes. */
const handleSearchQuerySetsResetAllPost: Handler = async (c) => {
  let jsonBody: unknown;
  try {
    jsonBody = await c.req.json();
  } catch {
    return c.json({ message: "Invalid JSON" }, 400);
  }

  const parsed = searchQuerySetsResetAllBodySchema.safeParse(jsonBody);
  if (!parsed.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  try {
    const result = await deleteAllSearchQuerySets();
    return c.json({ deleted: result.count });
  } catch (error) {
    if (isPrismaForeignKeyViolation(error)) {
      return c.json(
        {
          message:
            "Cannot delete search query sets while data sources still reference member queries.",
        },
        409,
      );
    }
    throw error;
  }
};

export type SearchQuerySetsTableV1CustomActionId = "reset-all";

type SearchQuerySetsTableV1CustomActionRegistryValue = Omit<
  DashboardPageCustomAction,
  "id" | "path"
> & {
  handler: Handler;
};

const searchQuerySetsTableV1CustomActionRegistry = {
  "reset-all": {
    ...buildResetAllActionManifest({
      label: "Reset all sets",
      description:
        "Permanently deletes every search query set and its member queries. This cannot be undone.",
      confirmMessage:
        "Delete ALL search query sets and their member queries? This cannot be undone.",
      confirmToken: searchQuerySetsResetAllConfirmToken,
    }),
    handler: handleSearchQuerySetsResetAllPost,
  },
} satisfies Record<
  SearchQuerySetsTableV1CustomActionId,
  SearchQuerySetsTableV1CustomActionRegistryValue
>;

export type SearchQuerySetsTableV1CustomActionDefinition = {
  manifest: DashboardPageCustomAction;
  handler: Handler;
};

/** Ordered list derived from the registry for manifest and route wiring. */
export const searchQuerySetsTableV1CustomActions = (
  [...Object.entries(searchQuerySetsTableV1CustomActionRegistry)] as [
    SearchQuerySetsTableV1CustomActionId,
    SearchQuerySetsTableV1CustomActionRegistryValue,
  ][]
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([id, row]): SearchQuerySetsTableV1CustomActionDefinition => {
    const { handler, ...manifestRest } = row;
    return {
      manifest: {
        id,
        ...manifestRest,
        path: `/${id}`,
      } satisfies DashboardPageCustomAction,
      handler,
    };
  }) satisfies readonly SearchQuerySetsTableV1CustomActionDefinition[];

/** Manifest `customActions` slice for {@link searchQuerySetsDashboardPage}. */
export const searchQuerySetsCustomActionsForManifest =
  searchQuerySetsTableV1CustomActions.map((entry) => entry.manifest);

/** Route registrations for {@link registerTableV1CustomActionRoutes}. */
export const searchQuerySetsTableV1CustomActionRegistrations =
  searchQuerySetsTableV1CustomActions.map((entry) => ({
    path: entry.manifest.path,
    method: entry.manifest.method,
    handler: entry.handler,
  }));
