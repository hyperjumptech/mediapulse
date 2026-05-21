/**
 * Declares data-sources table-v1 custom actions (manifest rows + Hono handlers).
 */

import type { DashboardPageCustomAction } from "@hermes/domain-contract";
import { prisma } from "@mediapulse/database";
import type { Handler } from "hono";

import {
  buildResetAllActionManifest,
  createResetAllPostHandler,
} from "../../lib/table-v1-reset-all-action";

/** Confirm token required in the POST body for reset-all. */
export const dataSourcesResetAllConfirmToken =
  "DELETE_ALL_DATA_SOURCES" as const;

export type DataSourcesTableV1CustomActionId = "reset-all";

type DataSourcesTableV1CustomActionRegistryValue = Omit<
  DashboardPageCustomAction,
  "id" | "path"
> & {
  handler: Handler;
};

const dataSourcesTableV1CustomActionRegistry = {
  "reset-all": {
    ...buildResetAllActionManifest({
      label: "Reset all data sources",
      description:
        "Permanently deletes every collected article and page. This cannot be undone.",
      confirmMessage:
        "Delete ALL data sources? This removes every collected article and page.",
      confirmToken: dataSourcesResetAllConfirmToken,
    }),
    handler: createResetAllPostHandler({
      confirmToken: dataSourcesResetAllConfirmToken,
      deleteAll: () => prisma.dataSource.deleteMany({}),
    }),
  },
} satisfies Record<
  DataSourcesTableV1CustomActionId,
  DataSourcesTableV1CustomActionRegistryValue
>;

export type DataSourcesTableV1CustomActionDefinition = {
  manifest: DashboardPageCustomAction;
  handler: Handler;
};

/** Ordered list derived from the registry for manifest and route wiring. */
export const dataSourcesTableV1CustomActions = (
  [...Object.entries(dataSourcesTableV1CustomActionRegistry)] as [
    DataSourcesTableV1CustomActionId,
    DataSourcesTableV1CustomActionRegistryValue,
  ][]
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([id, row]): DataSourcesTableV1CustomActionDefinition => {
    const { handler, ...manifestRest } = row;
    return {
      manifest: {
        id,
        ...manifestRest,
        path: `/${id}`,
      } satisfies DashboardPageCustomAction,
      handler,
    };
  }) satisfies readonly DataSourcesTableV1CustomActionDefinition[];

/** Manifest `customActions` slice for {@link dataSourcesDashboardPage}. */
export const dataSourcesCustomActionsForManifest =
  dataSourcesTableV1CustomActions.map((entry) => entry.manifest);

/** Route registrations for {@link registerTableV1CustomActionRoutes}. */
export const dataSourcesTableV1CustomActionRegistrations =
  dataSourcesTableV1CustomActions.map((entry) => ({
    path: entry.manifest.path,
    method: entry.manifest.method,
    handler: entry.handler,
  }));
