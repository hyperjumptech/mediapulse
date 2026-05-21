/**
 * Declares entities table-v1 custom actions (manifest rows + Hono handlers).
 */

import type { DashboardPageCustomAction } from "@hermes/domain-contract";
import { prisma } from "@mediapulse/database";
import type { Handler } from "hono";

import {
  buildResetAllActionManifest,
  createResetAllPostHandler,
} from "../../lib/table-v1-reset-all-action";

/** Confirm token required in the POST body for reset-all. */
export const entitiesResetAllConfirmToken = "DELETE_ALL_ENTITIES" as const;

export type EntitiesTableV1CustomActionId = "reset-all";

type EntitiesTableV1CustomActionRegistryValue = Omit<
  DashboardPageCustomAction,
  "id" | "path"
> & {
  handler: Handler;
};

const entitiesTableV1CustomActionRegistry = {
  "reset-all": {
    ...buildResetAllActionManifest({
      label: "Reset all entities",
      description:
        "Permanently deletes every canonical entity and related graph links. This cannot be undone.",
      confirmMessage:
        "Delete ALL entities? This removes every canonical entity and related graph links.",
      confirmToken: entitiesResetAllConfirmToken,
    }),
    handler: createResetAllPostHandler({
      confirmToken: entitiesResetAllConfirmToken,
      deleteAll: () => prisma.entity.deleteMany({}),
    }),
  },
} satisfies Record<
  EntitiesTableV1CustomActionId,
  EntitiesTableV1CustomActionRegistryValue
>;

export type EntitiesTableV1CustomActionDefinition = {
  manifest: DashboardPageCustomAction;
  handler: Handler;
};

/** Ordered list derived from the registry for manifest and route wiring. */
export const entitiesTableV1CustomActions = (
  [...Object.entries(entitiesTableV1CustomActionRegistry)] as [
    EntitiesTableV1CustomActionId,
    EntitiesTableV1CustomActionRegistryValue,
  ][]
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([id, row]): EntitiesTableV1CustomActionDefinition => {
    const { handler, ...manifestRest } = row;
    return {
      manifest: {
        id,
        ...manifestRest,
        path: `/${id}`,
      } satisfies DashboardPageCustomAction,
      handler,
    };
  }) satisfies readonly EntitiesTableV1CustomActionDefinition[];

/** Manifest `customActions` slice for {@link entitiesDashboardPage}. */
export const entitiesCustomActionsForManifest =
  entitiesTableV1CustomActions.map((entry) => entry.manifest);

/** Route registrations for {@link registerTableV1CustomActionRoutes}. */
export const entitiesTableV1CustomActionRegistrations =
  entitiesTableV1CustomActions.map((entry) => ({
    path: entry.manifest.path,
    method: entry.manifest.method,
    handler: entry.handler,
  }));
