/**
 * Declares tickers-only `table-v1` custom actions (manifest rows + Hono handlers), e.g. IDX JSON bulk import.
 */

import type { DashboardPageCustomAction } from "@hermes/domain-contract";
import type { Handler } from "hono";

import { importIdxTickersFromRequestBody } from "./import-idx-json";

/**
 * One tickers table-v1 custom action: Hermes manifest row plus the Hono handler that serves it.
 */
export type TickersTableV1CustomActionDefinition = {
  manifest: DashboardPageCustomAction;
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
 * Single registry for tickers custom actions: manifest metadata and route handler are defined together
 * so a new action cannot be advertised without a mounted handler (and vice versa).
 */
export const tickersTableV1CustomActions = [
  {
    manifest: {
      id: "import-idx-json",
      label: "Import IDX JSON",
      description:
        "Upload a JSON file in IDX company profiles format (object with a data array).",
      ui: "json-file-upload",
      method: "POST",
      path: "/import-idx-json",
      accept: ".json,application/json",
    } satisfies DashboardPageCustomAction,
    handler: handleTickersImportIdxJsonPost,
  },
] as const satisfies readonly TickersTableV1CustomActionDefinition[];

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
