import type { DashboardViewInput } from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";

/** URL path segment for this resource under `/v1/hermes-dashboard/`. */
export const queryAnalysisRunsHermesPathSegment =
  "query-analysis-runs" as const;

/** Hermes `table-v1` manifest for the query-analysis per-query decision chronicle. */
export const queryAnalysisRunsDashboardPage = {
  id: queryAnalysisRunsHermesPathSegment,
  label: "Query Analysis Runs",
  description:
    "Per-run chronicle from the query-analysis agent: each generated query and whether it was included or rejected, with the reason (read-only). Open a row to see every query decision.",
  pathSegment: queryAnalysisRunsHermesPathSegment,
  kind: "resource-table" as const,
  placement: "sidebar" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(
    queryAnalysisRunsHermesPathSegment,
  ),
  order: 56,
  columns: columnsFor<ListItem>()([
    { key: "tickerSymbol", label: "Ticker", type: "text" },
    { key: "generated", label: "Generated", type: "text" },
    { key: "included", label: "Included", type: "text" },
    { key: "rejected", label: "Rejected", type: "text" },
    { key: "executionId", label: "Execution id", type: "text" },
    { key: "createdAt", label: "Created", type: "date-time" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()([
    "tickerSymbol",
    "executionId",
  ]),
  sortableFields: rowFieldKeysFor<ListItem>()(["createdAt"]),
  actions: { create: false, update: false, delete: false, view: true },
} satisfies DashboardViewInput;
