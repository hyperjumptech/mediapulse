/**
 * Declares search-queries table-v1 custom actions (manifest rows + Hono handlers).
 */

import type { DashboardPageCustomAction } from "@hermes/domain-contract";
import { prisma } from "@mediapulse/database";
import type { Handler } from "hono";

import {
  buildResetAllActionManifest,
  createResetAllPostHandler,
} from "../../lib/table-v1-reset-all-action";

/** Confirm token required in the POST body for reset-all. */
export const searchQueriesResetAllConfirmToken =
  "DELETE_ALL_SEARCH_QUERIES" as const;

export type SearchQueriesTableV1CustomActionId = "reset-all";

type SearchQueriesTableV1CustomActionRegistryValue = Omit<
  DashboardPageCustomAction,
  "id" | "path"
> & {
  handler: Handler;
};

const searchQueriesTableV1CustomActionRegistry = {
  "reset-all": {
    ...buildResetAllActionManifest({
      label: "Reset all queries",
      description:
        "Permanently deletes every search query row. Rows referenced by data sources will block this operation.",
      confirmMessage:
        "Delete ALL search queries? Rows referenced by data sources will block this operation.",
      confirmToken: searchQueriesResetAllConfirmToken,
    }),
    handler: createResetAllPostHandler({
      confirmToken: searchQueriesResetAllConfirmToken,
      deleteAll: () => prisma.searchQuery.deleteMany({}),
      blockedMessage:
        "Cannot delete search queries while data sources still reference them.",
    }),
  },
} satisfies Record<
  SearchQueriesTableV1CustomActionId,
  SearchQueriesTableV1CustomActionRegistryValue
>;

export type SearchQueriesTableV1CustomActionDefinition = {
  manifest: DashboardPageCustomAction;
  handler: Handler;
};

/** Ordered list derived from the registry for manifest and route wiring. */
export const searchQueriesTableV1CustomActions = (
  [...Object.entries(searchQueriesTableV1CustomActionRegistry)] as [
    SearchQueriesTableV1CustomActionId,
    SearchQueriesTableV1CustomActionRegistryValue,
  ][]
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([id, row]): SearchQueriesTableV1CustomActionDefinition => {
    const { handler, ...manifestRest } = row;
    return {
      manifest: {
        id,
        ...manifestRest,
        path: `/${id}`,
      } satisfies DashboardPageCustomAction,
      handler,
    };
  }) satisfies readonly SearchQueriesTableV1CustomActionDefinition[];

/** Manifest `customActions` slice for {@link searchQueriesDashboardPage}. */
export const searchQueriesCustomActionsForManifest =
  searchQueriesTableV1CustomActions.map((entry) => entry.manifest);

/** Route registrations for {@link registerTableV1CustomActionRoutes}. */
export const searchQueriesTableV1CustomActionRegistrations =
  searchQueriesTableV1CustomActions.map((entry) => ({
    path: entry.manifest.path,
    method: entry.manifest.method,
    handler: entry.handler,
  }));
