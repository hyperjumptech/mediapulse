import type { DashboardPageCustomAction } from "@hermes/domain-contract";
import { prisma } from "@mediapulse/database";
import type { Handler } from "hono";

import {
  buildResetAllActionManifest,
  createResetAllPostHandler,
} from "../../lib/table-v1-reset-all-action";
import { importTickerProfilesFromRequestBody } from "./lib/import-ticker-profiles-json";

export type TickerProfilesTableV1CustomActionDefinition = {
  manifest: DashboardPageCustomAction;
  handler: Handler;
};

export type TickerProfilesTableV1CustomActionId =
  | "import-profiles-json"
  | "reset-all";

export const tickerProfilesResetAllConfirmToken =
  "DELETE_ALL_TICKER_PROFILES" as const;

type TickerProfilesTableV1CustomActionRegistryValue = Omit<
  DashboardPageCustomAction,
  "id" | "path"
> & {
  handler: Handler;
};

const handleImportProfilesJsonPost: Handler = async (c) => {
  let jsonBody: unknown;
  try {
    jsonBody = await c.req.json();
  } catch {
    return c.json({ message: "Invalid JSON" }, 400);
  }

  const result = await importTickerProfilesFromRequestBody(jsonBody);
  if (!result.ok) {
    return c.json({ message: result.message }, result.status);
  }

  return c.json({
    added: result.added,
    updated: result.updated,
    skipped: result.skipped,
  });
};

const tickerProfilesTableV1CustomActionRegistry = {
  "import-profiles-json": {
    label: "Import profiles JSON",
    description:
      "Upload the curated ticker profiles file (array of rows keyed by symbol). Rows whose symbol has no ticker are skipped.",
    ui: "json-file-upload",
    method: "POST",
    accept: ".json,application/json",
    handler: handleImportProfilesJsonPost,
  },
  "reset-all": {
    ...buildResetAllActionManifest({
      label: "Reset all ticker profiles",
      description:
        "Permanently deletes every ticker profile row. Tickers themselves are left untouched.",
      confirmMessage:
        "Delete ALL ticker profiles? Query analysis will fall back to own-company-only queries until profiles are re-uploaded.",
      confirmToken: tickerProfilesResetAllConfirmToken,
    }),
    handler: createResetAllPostHandler({
      confirmToken: tickerProfilesResetAllConfirmToken,
      deleteAll: () => prisma.tickerProfile.deleteMany({}),
      blockedMessage:
        "Cannot delete ticker profiles while other records still reference them.",
    }),
  },
} satisfies Record<
  TickerProfilesTableV1CustomActionId,
  TickerProfilesTableV1CustomActionRegistryValue
>;

export const tickerProfilesTableV1CustomActions = (
  [...Object.entries(tickerProfilesTableV1CustomActionRegistry)] as [
    TickerProfilesTableV1CustomActionId,
    TickerProfilesTableV1CustomActionRegistryValue,
  ][]
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([id, row]): TickerProfilesTableV1CustomActionDefinition => {
    const { handler, ...manifestRest } = row;

    return {
      manifest: {
        id,
        ...manifestRest,
        path: `/${id}`,
      } satisfies DashboardPageCustomAction,
      handler,
    };
  }) satisfies readonly TickerProfilesTableV1CustomActionDefinition[];

export const tickerProfilesCustomActionsForManifest =
  tickerProfilesTableV1CustomActions.map((entry) => entry.manifest);

export const tickerProfilesTableV1CustomActionRegistrations =
  tickerProfilesTableV1CustomActions.map((entry) => ({
    path: entry.manifest.path,
    method: entry.manifest.method,
    handler: entry.handler,
  }));
