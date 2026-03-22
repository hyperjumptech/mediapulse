/**
 * Declares tickers-only `table-v1` custom actions (manifest rows + Hono handlers), e.g. IDX JSON bulk import.
 */

import type { DashboardPageCustomAction } from "@hermes/domain-contract";
import type { Handler } from "hono";

import { importIdxTickersFromRequestBody } from "./lib/import-idx-json";

/**
 * One tickers table-v1 custom action: Hermes manifest row plus the Hono handler that serves it.
 */
export type TickersTableV1CustomActionDefinition = {
  manifest: DashboardPageCustomAction;
  handler: Handler;
};

/**
 * Allowed custom-action slugs for the tickers table. Add a member here, then add the matching key
 * on {@link tickersTableV1CustomActionRegistry}; TypeScript rejects wrong keys, missing entries, or extras.
 */
export type TickersTableV1CustomActionId = "import-idx-json";

type TickersTableV1CustomActionRegistryValue = Omit<
  DashboardPageCustomAction,
  "id" | "path"
> & {
  handler: Handler;
};

/**
 * HTTP handler for IDX JSON bulk import; body parsing in `importIdxTickersFromRequestBody`.
 */
const handleTickersImportIdxJsonPost: Handler = async (c) => {
  let jsonBody: unknown;
  try {
    jsonBody = await c.req.json();
  } catch {
    return c.json({ message: "Invalid JSON" }, 400);
  }

  const result = await importIdxTickersFromRequestBody(jsonBody);
  if (!result.ok) {
    return c.json({ message: result.message }, result.status);
  }

  return c.json({ added: result.added, updated: result.updated });
};

/**
 * Single registry: each slug is an object key (checked against {@link TickersTableV1CustomActionId}), so the
 * manifest `id` and route path cannot be mistyped relative to each other. Values carry the handler and the
 * rest of the manifest (no `id`/`path` — those come from the key).
 */
const tickersTableV1CustomActionRegistry = {
  "import-idx-json": {
    label: "Import IDX JSON",
    description:
      "Upload a JSON file in IDX company profiles format (object with a data array).",
    ui: "json-file-upload",
    method: "POST",
    accept: ".json,application/json",
    handler: handleTickersImportIdxJsonPost,
  },
} satisfies Record<
  TickersTableV1CustomActionId,
  TickersTableV1CustomActionRegistryValue
>;

/**
 * Ordered list derived from {@link tickersTableV1CustomActionRegistry} for manifest and route wiring.
 */
export const tickersTableV1CustomActions = (
  [...Object.entries(tickersTableV1CustomActionRegistry)] as [
    TickersTableV1CustomActionId,
    TickersTableV1CustomActionRegistryValue,
  ][]
)
  .sort(([a], [b]) => a.localeCompare(b))
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

/**
 * Manifest `customActions` slice for `tickersDashboardPage` in `dashboard-page.ts`, derived from {@link tickersTableV1CustomActions}.
 */
export const tickersCustomActionsForManifest = tickersTableV1CustomActions.map(
  (entry) => entry.manifest,
);

/**
 * Route registrations for {@link registerTableV1CustomActionRoutes}, derived from the same registry.
 */
export const tickersTableV1CustomActionRegistrations =
  tickersTableV1CustomActions.map((entry) => ({
    path: entry.manifest.path,
    method: entry.manifest.method,
    handler: entry.handler,
  }));
