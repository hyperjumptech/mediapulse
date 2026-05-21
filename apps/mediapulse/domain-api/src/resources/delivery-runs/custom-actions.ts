/**
 * Declares delivery-runs table-v1 custom actions (manifest rows + Hono handlers).
 */

import type { DashboardPageCustomAction } from "@hermes/domain-contract";
import { prisma } from "@mediapulse/database";
import type { Handler } from "hono";

import {
  buildResetAllActionManifest,
  createResetAllPostHandler,
} from "../../lib/table-v1-reset-all-action";

/** Confirm token required in the POST body for reset-all. */
export const deliveryRunsResetAllConfirmToken =
  "DELETE_ALL_DELIVERY_RUNS" as const;

export type DeliveryRunsTableV1CustomActionId = "reset-all";

type DeliveryRunsTableV1CustomActionRegistryValue = Omit<
  DashboardPageCustomAction,
  "id" | "path"
> & {
  handler: Handler;
};

const deliveryRunsTableV1CustomActionRegistry = {
  "reset-all": {
    ...buildResetAllActionManifest({
      label: "Reset all delivery runs",
      description:
        "Permanently deletes every delivery run diagnostic record. This cannot be undone.",
      confirmMessage:
        "Delete ALL delivery runs? This removes every delivery diagnostic record.",
      confirmToken: deliveryRunsResetAllConfirmToken,
    }),
    handler: createResetAllPostHandler({
      confirmToken: deliveryRunsResetAllConfirmToken,
      deleteAll: () => prisma.deliveryRun.deleteMany({}),
    }),
  },
} satisfies Record<
  DeliveryRunsTableV1CustomActionId,
  DeliveryRunsTableV1CustomActionRegistryValue
>;

export type DeliveryRunsTableV1CustomActionDefinition = {
  manifest: DashboardPageCustomAction;
  handler: Handler;
};

/** Ordered list derived from the registry for manifest and route wiring. */
export const deliveryRunsTableV1CustomActions = (
  [...Object.entries(deliveryRunsTableV1CustomActionRegistry)] as [
    DeliveryRunsTableV1CustomActionId,
    DeliveryRunsTableV1CustomActionRegistryValue,
  ][]
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([id, row]): DeliveryRunsTableV1CustomActionDefinition => {
    const { handler, ...manifestRest } = row;
    return {
      manifest: {
        id,
        ...manifestRest,
        path: `/${id}`,
      } satisfies DashboardPageCustomAction,
      handler,
    };
  }) satisfies readonly DeliveryRunsTableV1CustomActionDefinition[];

/** Manifest `customActions` slice for {@link deliveryRunsDashboardPage}. */
export const deliveryRunsCustomActionsForManifest =
  deliveryRunsTableV1CustomActions.map((entry) => entry.manifest);

/** Route registrations for {@link registerTableV1CustomActionRoutes}. */
export const deliveryRunsTableV1CustomActionRegistrations =
  deliveryRunsTableV1CustomActions.map((entry) => ({
    path: entry.manifest.path,
    method: entry.manifest.method,
    handler: entry.handler,
  }));
