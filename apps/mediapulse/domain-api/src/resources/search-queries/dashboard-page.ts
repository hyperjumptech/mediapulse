/**
 * Hermes `table-v1` manifest for search queries (delete-only actions) and exported path segment.
 */

import type { DashboardPageInput } from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";

/** URL path segment for this resource under `/v1/hermes-dashboard/`. */
export const searchQueriesHermesPathSegment = "search-queries" as const;

/** Hermes `table-v1` manifest page for search queries. */
export const searchQueriesDashboardPage = {
  id: searchQueriesHermesPathSegment,
  label: "Search Query",
  description: "Manage generated search queries and remove unused rows.",
  pathSegment: searchQueriesHermesPathSegment,
  template: "table-v1" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(searchQueriesHermesPathSegment),
  order: 40,
  columns: columnsFor<ListItem>()([
    { key: "tickerSymbol", label: "Ticker", type: "text" },
    { key: "tickerName", label: "Ticker Name", type: "text" },
    { key: "text", label: "Search Query", type: "text" },
    { key: "createdAt", label: "Created", type: "date-time" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()([
    "tickerName",
    "tickerSymbol",
    "text",
  ]),
  sortableFields: rowFieldKeysFor<ListItem>()(["createdAt"]),
  actions: { create: false, update: false, delete: true, view: false },
} satisfies DashboardPageInput;
