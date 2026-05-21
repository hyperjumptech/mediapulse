/**
 * Declares entity-types table-v1 custom actions (manifest rows + Hono handlers).
 */

import type { DashboardPageCustomAction } from "@hermes/domain-contract";
import { prisma } from "@mediapulse/database";
import type { Handler } from "hono";

import {
  buildResetAllActionManifest,
  createResetAllPostHandler,
} from "../../lib/table-v1-reset-all-action";

/** Confirm token required in the POST body for reset-all. */
export const entityTypesResetAllConfirmToken =
  "DELETE_ALL_ENTITY_TYPES" as const;

export type EntityTypesTableV1CustomActionId = "reset-all";

type EntityTypesTableV1CustomActionRegistryValue = Omit<
  DashboardPageCustomAction,
  "id" | "path"
> & {
  handler: Handler;
};

const entityTypesTableV1CustomActionRegistry = {
  "reset-all": {
    ...buildResetAllActionManifest({
      label: "Reset all entity types",
      description:
        "Permanently deletes every entity type row. Types referenced by entities will block this operation.",
      confirmMessage:
        "Delete ALL entity types? Types referenced by entities will block this operation.",
      confirmToken: entityTypesResetAllConfirmToken,
    }),
    handler: createResetAllPostHandler({
      confirmToken: entityTypesResetAllConfirmToken,
      deleteAll: () => prisma.entityType.deleteMany({}),
      blockedMessage:
        "Cannot delete entity types while entities still reference them.",
    }),
  },
} satisfies Record<
  EntityTypesTableV1CustomActionId,
  EntityTypesTableV1CustomActionRegistryValue
>;

export type EntityTypesTableV1CustomActionDefinition = {
  manifest: DashboardPageCustomAction;
  handler: Handler;
};

/** Ordered list derived from the registry for manifest and route wiring. */
export const entityTypesTableV1CustomActions = (
  [...Object.entries(entityTypesTableV1CustomActionRegistry)] as [
    EntityTypesTableV1CustomActionId,
    EntityTypesTableV1CustomActionRegistryValue,
  ][]
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([id, row]): EntityTypesTableV1CustomActionDefinition => {
    const { handler, ...manifestRest } = row;
    return {
      manifest: {
        id,
        ...manifestRest,
        path: `/${id}`,
      } satisfies DashboardPageCustomAction,
      handler,
    };
  }) satisfies readonly EntityTypesTableV1CustomActionDefinition[];

/** Manifest `customActions` slice for {@link entityTypesDashboardPage}. */
export const entityTypesCustomActionsForManifest =
  entityTypesTableV1CustomActions.map((entry) => entry.manifest);

/** Route registrations for {@link registerTableV1CustomActionRoutes}. */
export const entityTypesTableV1CustomActionRegistrations =
  entityTypesTableV1CustomActions.map((entry) => ({
    path: entry.manifest.path,
    method: entry.manifest.method,
    handler: entry.handler,
  }));
