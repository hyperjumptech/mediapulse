/**
 * Hermes `table-v1` manifest for collected data sources (read-only list + view detail) and path segment.
 */

import type { DashboardViewInput, DetailBlock } from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  collectionGateStatusSelectListFilter,
  collectionSourceSelectListFilter,
  createdAtDateRangeListFilter,
  tickerIdSelectListFilter,
} from "../../hermes-dashboard/templates/table-v1/list-filter-definitions";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";
import { dataSourcesCustomActionsForManifest } from "./custom-actions";

/** URL path segment for this resource under `/v1/hermes-dashboard/`. */
export const dataSourcesHermesPathSegment = "data-sources" as const;

const dataSourcesGateBlock = {
  type: "keyValue",
  label: "Collection gate",
  sectionRule: {
    when: "present(collectionGateStatus)",
    badge: "outline",
    label: "Page collection",
  },
  rows: [
    { field: "collectionGateStatusLabel", label: "Status" },
    { field: "collectionGateReason", label: "Reason" },
  ],
} satisfies DetailBlock;

const dataSourcesCuratedSourceBlock = {
  type: "keyValue",
  label: "Curated source",
  sectionRule: {
    when: "present(curatedSourceId)",
    badge: "success",
    label: "Curated listing",
  },
  rows: [
    {
      field: "curatedSourceName",
      label: "Name",
      linkTemplate:
        "/dashboard/{integrationId}/curated-sources/{curatedSourceId}",
    },
    {
      field: "curatedSourceListingUrl",
      label: "Listing URL",
      copyAction: true,
    },
  ],
} satisfies DetailBlock;

/** Hermes `table-v1` manifest for collected data sources. */
export const dataSourcesDashboardPage = {
  id: dataSourcesHermesPathSegment,
  label: "Data Sources",
  description:
    "Articles and pages collected by the data-collection agent from active search queries (read-only).",
  pathSegment: dataSourcesHermesPathSegment,
  kind: "resource-table" as const,
  placement: "sidebar" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(dataSourcesHermesPathSegment),
  order: 35,
  columns: columnsFor<ListItem>()([
    { key: "tickerSymbol", label: "Ticker", type: "text" },
    { key: "title", label: "Title", type: "text" },
    { key: "url", label: "URL", type: "text" },
    { key: "searchQueryText", label: "Search query", type: "text" },
    { key: "collectionSourceLabel", label: "Collected by", type: "text" },
    {
      key: "collectionGateStatusLabel",
      label: "Gate",
      type: "text",
    },
    { key: "contentPreview", label: "Preview", type: "text" },
    { key: "contentLength", label: "Chars", type: "text" },
    { key: "createdAt", label: "Created", type: "date-time" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()([
    "title",
    "url",
    "tickerSymbol",
    "tickerName",
    "searchQueryText",
    "collectionSourceLabel",
    "collectionGateStatusLabel",
  ]),
  sortableFields: rowFieldKeysFor<ListItem>()([
    "createdAt",
    "title",
    "url",
    "tickerSymbol",
    "searchQueryText",
  ]),
  listFilters: [
    tickerIdSelectListFilter,
    collectionSourceSelectListFilter,
    collectionGateStatusSelectListFilter,
    createdAtDateRangeListFilter,
  ],
  actions: { create: false, update: false, delete: false, view: true },
  customActions: dataSourcesCustomActionsForManifest,
  detailBlocks: [dataSourcesGateBlock, dataSourcesCuratedSourceBlock],
} satisfies DashboardViewInput;
