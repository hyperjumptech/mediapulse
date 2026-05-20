/**
 * Hermes `table-v1` manifest for search query sets (full CRUD + detail blocks).
 */

import type { DashboardPageInput, DetailBlock } from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";
import {
  searchQuerySetCreateFormJsonSchema,
  searchQuerySetUpdateFormJsonSchema,
} from "./write-body-schemas";

/** URL path segment for this resource under `/v1/hermes-dashboard/`. */
export const searchQuerySetsHermesPathSegment = "search-query-sets" as const;

const searchQuerySetsMetadataBlock = {
  type: "keyValue",
  label: "Metadata",
  rows: [
    { field: "id", label: "Set id", copyAction: true },
    {
      field: "tickerSymbol",
      label: "Ticker",
      linkTemplate: "/dashboard/{integrationId}/tickers/{tickerId}",
      copyAction: true,
    },
    { field: "tickerName", label: "Ticker name" },
    { field: "isActive", label: "Active", format: "text" },
    { field: "generatedAt", label: "Generated", format: "date-time" },
    { field: "generationSource", label: "Generation source" },
    { field: "agentJobId", label: "Hermes job id", copyAction: true },
    { field: "createdAt", label: "Created", format: "date-time" },
    { field: "updatedAt", label: "Updated", format: "date-time" },
  ],
} satisfies DetailBlock;

const searchQuerySetsStrategyBlock = {
  type: "markdown",
  label: "Strategy snapshot",
  field: "strategySnapshotMarkdown",
  copyAction: true,
} satisfies DetailBlock;

const searchQuerySetsQueriesBlock = {
  type: "subTable",
  label: "Queries",
  field: "queries",
  emptyState: "No queries in this set.",
  columns: [
    { field: "text", label: "Query", type: "text", truncate: 80 },
    { field: "intent", label: "Intent", type: "text" },
    { field: "source", label: "Source", type: "text" },
    { field: "rank", label: "Rank", type: "number" },
  ],
} satisfies DetailBlock;

/** Hermes `table-v1` manifest page for search query sets. */
export const searchQuerySetsDashboardPage = {
  id: searchQuerySetsHermesPathSegment,
  label: "Search query sets",
  description:
    "Versioned search query sets per ticker. Create, activate, and inspect queries used by data collection.",
  pathSegment: searchQuerySetsHermesPathSegment,
  template: "table-v1" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(searchQuerySetsHermesPathSegment),
  order: 38,
  columns: columnsFor<ListItem>()([
    { key: "tickerSymbol", label: "Ticker", type: "text" },
    { key: "tickerName", label: "Ticker name", type: "text" },
    { key: "isActive", label: "Active", type: "text" },
    { key: "generatedAt", label: "Generated", type: "date-time" },
    { key: "generationSource", label: "Source", type: "text" },
    { key: "queryCount", label: "Queries", type: "text" },
    { key: "agentJobId", label: "Hermes job id", type: "text" },
    { key: "createdAt", label: "Created", type: "date-time" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()([
    "tickerSymbol",
    "tickerName",
    "generationSource",
    "agentJobId",
  ]),
  sortableFields: rowFieldKeysFor<ListItem>()([
    "generatedAt",
    "createdAt",
    "isActive",
    "queryCount",
  ]),
  actions: { create: true, update: true, delete: true, view: true },
  createNavigation: "full-page",
  createSchema: searchQuerySetCreateFormJsonSchema,
  updateSchema: searchQuerySetUpdateFormJsonSchema,
  detailBlocks: [
    searchQuerySetsMetadataBlock,
    searchQuerySetsStrategyBlock,
    searchQuerySetsQueriesBlock,
  ],
} satisfies DashboardPageInput;
