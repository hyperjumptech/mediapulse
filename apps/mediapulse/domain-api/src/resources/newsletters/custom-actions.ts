/**
 * Declares newsletters table-v1 custom actions (manifest rows + Hono handlers).
 */

import type { DashboardPageCustomAction } from "@hermes/domain-contract";
import { prisma } from "@mediapulse/database";
import type { Handler } from "hono";

import {
  buildResetAllActionManifest,
  createResetAllPostHandler,
} from "../../lib/table-v1-reset-all-action";

/** Confirm token required in the POST body for reset-all. */
export const newslettersResetAllConfirmToken =
  "DELETE_ALL_NEWSLETTERS" as const;

export type NewslettersTableV1CustomActionId = "reset-all";

type NewslettersTableV1CustomActionRegistryValue = Omit<
  DashboardPageCustomAction,
  "id" | "path"
> & {
  handler: Handler;
};

const newslettersTableV1CustomActionRegistry = {
  "reset-all": {
    ...buildResetAllActionManifest({
      label: "Reset all newsletters",
      description:
        "Permanently deletes every generated newsletter row. This cannot be undone.",
      confirmMessage:
        "Delete ALL newsletters? This removes every generated newsletter.",
      confirmToken: newslettersResetAllConfirmToken,
    }),
    handler: createResetAllPostHandler({
      confirmToken: newslettersResetAllConfirmToken,
      deleteAll: () => prisma.newsletter.deleteMany({}),
    }),
  },
} satisfies Record<
  NewslettersTableV1CustomActionId,
  NewslettersTableV1CustomActionRegistryValue
>;

export type NewslettersTableV1CustomActionDefinition = {
  manifest: DashboardPageCustomAction;
  handler: Handler;
};

/** Ordered list derived from the registry for manifest and route wiring. */
export const newslettersTableV1CustomActions = (
  [...Object.entries(newslettersTableV1CustomActionRegistry)] as [
    NewslettersTableV1CustomActionId,
    NewslettersTableV1CustomActionRegistryValue,
  ][]
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([id, row]): NewslettersTableV1CustomActionDefinition => {
    const { handler, ...manifestRest } = row;
    return {
      manifest: {
        id,
        ...manifestRest,
        path: `/${id}`,
      } satisfies DashboardPageCustomAction,
      handler,
    };
  }) satisfies readonly NewslettersTableV1CustomActionDefinition[];

/** Manifest `customActions` slice for {@link newslettersDashboardPage}. */
export const newslettersCustomActionsForManifest =
  newslettersTableV1CustomActions.map((entry) => entry.manifest);

/** Route registrations for {@link registerTableV1CustomActionRoutes}. */
export const newslettersTableV1CustomActionRegistrations =
  newslettersTableV1CustomActions.map((entry) => ({
    path: entry.manifest.path,
    method: entry.manifest.method,
    handler: entry.handler,
  }));
