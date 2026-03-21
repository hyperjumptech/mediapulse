import type { DashboardPageInput } from "@hermes/domain-contract";
import {
  HermesDashboardResource,
  hermesDashboardManifestApiPrefix,
} from "../../hermes-dashboard/paths";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";

/** Hermes `table-v1` manifest page for search queries. */
export const searchQueriesDashboardPage = {
  id: HermesDashboardResource.searchQueries,
  label: "Search Query",
  description: "Manage generated search queries and remove unused rows.",
  pathSegment: HermesDashboardResource.searchQueries,
  template: "table-v1" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(
    HermesDashboardResource.searchQueries,
  ),
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
  actions: { create: false, update: false, delete: true },
} satisfies DashboardPageInput;
