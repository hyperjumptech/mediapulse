import type { DashboardPageCustomAction } from "@hermes/domain-contract";
import { prisma } from "@mediapulse/database";
import { env } from "@mediapulse/env";
import type { Handler } from "hono";

import {
  buildResetAllActionManifest,
  createResetAllPostHandler,
} from "../../lib/table-v1-reset-all-action";
import { createSyncFromKnowledgeGraphHandler } from "./lib/sync-from-knowledge-graph";

export type TickersTableV1CustomActionDefinition = {
  manifest: DashboardPageCustomAction;
  handler: Handler;
};

export type TickersTableV1CustomActionId =
  | "reset-all"
  | "sync-from-knowledge-graph";

export const tickersResetAllConfirmToken = "DELETE_ALL_TICKERS" as const;

export const tickersSyncFromKnowledgeGraphConfirmToken =
  "SYNC_TICKERS_FROM_KNOWLEDGE_GRAPH" as const;

type TickersTableV1CustomActionRegistryValue = Omit<
  DashboardPageCustomAction,
  "id" | "path"
> & {
  handler: Handler;
};

const tickersTableV1CustomActionRegistry = {
  "reset-all": {
    ...buildResetAllActionManifest({
      label: "Reset all tickers",
      description:
        "Permanently deletes every ticker row. Tickers referenced by other records will block this operation.",
      confirmMessage:
        "Delete ALL tickers? Tickers referenced by other records will block this operation.",
      confirmToken: tickersResetAllConfirmToken,
    }),
    handler: createResetAllPostHandler({
      confirmToken: tickersResetAllConfirmToken,
      deleteAll: () => prisma.ticker.deleteMany({}),
      blockedMessage:
        "Cannot delete tickers while other records still reference them.",
    }),
  },
  "sync-from-knowledge-graph": {
    label: "Sync from knowledge graph",
    description:
      "Adds every listed company from the knowledge graph and updates ticker names. Never deletes a ticker.",
    ui: "danger-confirm",
    method: "POST",
    confirmMessage:
      "Add every listed company from the knowledge graph and update ticker names to match it? No ticker is deleted.",
    confirmToken: tickersSyncFromKnowledgeGraphConfirmToken,
    handler: createSyncFromKnowledgeGraphHandler({
      confirmToken: tickersSyncFromKnowledgeGraphConfirmToken,
      readEnv: () => env,
      db: prisma,
    }),
  },
} satisfies Record<
  TickersTableV1CustomActionId,
  TickersTableV1CustomActionRegistryValue
>;

export const tickersTableV1CustomActions = (
  [...Object.entries(tickersTableV1CustomActionRegistry)] as [
    TickersTableV1CustomActionId,
    TickersTableV1CustomActionRegistryValue,
  ][]
)
  .sort(([firstId], [secondId]) => firstId.localeCompare(secondId))
  .map(([id, row]): TickersTableV1CustomActionDefinition => {
    const { handler, ...manifestRest } = row;

    return {
      manifest: {
        id,
        ...manifestRest,
        path: `/${id}`,
      } satisfies DashboardPageCustomAction,
      handler,
    };
  }) satisfies readonly TickersTableV1CustomActionDefinition[];

export const tickersCustomActionsForManifest = tickersTableV1CustomActions.map(
  (entry) => entry.manifest,
);

export const tickersTableV1CustomActionRegistrations =
  tickersTableV1CustomActions.map((entry) => ({
    path: entry.manifest.path,
    method: entry.manifest.method,
    handler: entry.handler,
  }));
