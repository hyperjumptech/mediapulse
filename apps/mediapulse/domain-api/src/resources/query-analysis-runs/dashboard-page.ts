import type { DashboardViewInput } from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";

export const queryAnalysisRunsHermesPathSegment =
  "query-analysis-runs" as const;

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
    { key: "generated", label: "Generated", type: "text", format: "number" },
    { key: "included", label: "Included", type: "text", format: "number" },
    { key: "rejected", label: "Rejected", type: "text", format: "number" },
    {
      key: "createdAt",
      label: "Created",
      type: "date-time",
      format: "date-time",
      mobile: "subtitle",
    },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()([
    "tickerSymbol",
    "executionId",
  ]),
  sortableFields: rowFieldKeysFor<ListItem>()(["createdAt"]),
  actions: { create: false, update: false, delete: false, view: true },
} satisfies DashboardViewInput;
