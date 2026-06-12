/**
 * Hermes `table-v1` manifest for tickers (custom actions, metadata form) and exported path segment.
 */

import { type DashboardViewInput } from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";
import { tickersCustomActionsForManifest } from "./custom-actions";
import {
  tickerCreateFormJsonSchema,
  tickerUpdateFormJsonSchema,
} from "./write-body-schemas";

/** URL path segment for this resource under `/v1/hermes-dashboard/`. */
export const tickersHermesPathSegment = "tickers" as const;

/** Hermes `table-v1` manifest page for the tickers resource. */
export const tickersDashboardPage = {
  id: tickersHermesPathSegment,
  label: "Tickers",
  description:
    "Ticker symbols and company names; admin-created or imported via IDX JSON.",
  pathSegment: tickersHermesPathSegment,
  kind: "resource-table" as const,
  placement: "sidebar" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(tickersHermesPathSegment),
  order: 10,
  columns: columnsFor<ListItem>()([
    { key: "symbol", label: "Symbol", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "createdAt", label: "Created", type: "date-time" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()(["symbol", "name"]),
  sortableFields: rowFieldKeysFor<ListItem>()(["symbol", "name", "createdAt"]),
  actions: { create: true, update: true, delete: true, view: false },
  createSchema: tickerCreateFormJsonSchema,
  updateSchema: tickerUpdateFormJsonSchema,
  customActions: tickersCustomActionsForManifest,
} satisfies DashboardViewInput;
