/**
 * Declares relation-types table-v1 custom actions (manifest rows + Hono handlers).
 */

import type { DashboardPageCustomAction } from "@hermes/domain-contract";
import { prisma } from "@mediapulse/database";
import type { Handler } from "hono";

import {
  buildResetAllActionManifest,
  createResetAllPostHandler,
} from "../../lib/table-v1-reset-all-action";

/** Confirm token required in the POST body for reset-all. */
export const relationTypesResetAllConfirmToken =
  "DELETE_ALL_RELATION_TYPES" as const;

export type RelationTypesTableV1CustomActionId = "reset-all";

type RelationTypesTableV1CustomActionRegistryValue = Omit<
  DashboardPageCustomAction,
  "id" | "path"
> & {
  handler: Handler;
};

const relationTypesTableV1CustomActionRegistry = {
  "reset-all": {
    ...buildResetAllActionManifest({
      label: "Reset all relation types",
      description:
        "Permanently deletes every relation type row. Types referenced by entity relations will block this operation.",
      confirmMessage:
        "Delete ALL relation types? Types referenced by entity relations will block this operation.",
      confirmToken: relationTypesResetAllConfirmToken,
    }),
    handler: createResetAllPostHandler({
      confirmToken: relationTypesResetAllConfirmToken,
      deleteAll: () => prisma.relationType.deleteMany({}),
      blockedMessage:
        "Cannot delete relation types while entity relations still reference them.",
    }),
  },
} satisfies Record<
  RelationTypesTableV1CustomActionId,
  RelationTypesTableV1CustomActionRegistryValue
>;

export type RelationTypesTableV1CustomActionDefinition = {
  manifest: DashboardPageCustomAction;
  handler: Handler;
};

/** Ordered list derived from the registry for manifest and route wiring. */
export const relationTypesTableV1CustomActions = (
  [...Object.entries(relationTypesTableV1CustomActionRegistry)] as [
    RelationTypesTableV1CustomActionId,
    RelationTypesTableV1CustomActionRegistryValue,
  ][]
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([id, row]): RelationTypesTableV1CustomActionDefinition => {
    const { handler, ...manifestRest } = row;
    return {
      manifest: {
        id,
        ...manifestRest,
        path: `/${id}`,
      } satisfies DashboardPageCustomAction,
      handler,
    };
  }) satisfies readonly RelationTypesTableV1CustomActionDefinition[];

/** Manifest `customActions` slice for {@link relationTypesDashboardPage}. */
export const relationTypesCustomActionsForManifest =
  relationTypesTableV1CustomActions.map((entry) => entry.manifest);

/** Route registrations for {@link registerTableV1CustomActionRoutes}. */
export const relationTypesTableV1CustomActionRegistrations =
  relationTypesTableV1CustomActions.map((entry) => ({
    path: entry.manifest.path,
    method: entry.manifest.method,
    handler: entry.handler,
  }));
