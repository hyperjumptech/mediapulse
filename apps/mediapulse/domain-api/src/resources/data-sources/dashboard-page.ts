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
  type ManifestColumnBadgeTones,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";
import { dataSourcesCustomActionsForManifest } from "./custom-actions";
import { COLLECTION_GATE_STATUS_LABEL } from "./collection-gate-status";

export const dataSourcesHermesPathSegment = "data-sources" as const;

const collectionGateBadgeTones = {
  [COLLECTION_GATE_STATUS_LABEL.passed]: "success",
  [COLLECTION_GATE_STATUS_LABEL.failed]: "failed",
} satisfies ManifestColumnBadgeTones;

const dataSourcesOverviewBlock = {
  type: "keyValue",
  rows: [
    {
      field: "url",
      label: "URL",
      linkTemplate: "{url}",
      copyAction: true,
    },
    { field: "tickerSymbol", label: "Ticker" },
    { field: "searchQueryText", label: "Search query" },
    { field: "collectionSourceLabel", label: "Collected by" },
    { field: "createdAt", label: "Collected", format: "date-time" },
  ],
} satisfies DetailBlock;

const dataSourcesContentBlock = {
  type: "markdown",
  label: "Content",
  field: "content",
  clampChars: 1200,
  copyAction: true,
} satisfies DetailBlock;

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
    { key: "title", label: "Title", type: "text", mobile: "subtitle" },
    {
      key: "url",
      label: "URL",
      type: "text",
      hideBelow: "lg",
      mobile: "hidden",
    },
    {
      key: "searchQueryText",
      label: "Search query",
      type: "text",
      hideBelow: "lg",
      mobile: "hidden",
    },
    { key: "collectionSourceLabel", label: "Collected by", type: "text" },
    {
      key: "collectionGateStatusLabel",
      label: "Gate",
      type: "text",
      format: "badge",
      badgeTones: collectionGateBadgeTones,
      mobile: "hidden",
      defaultHidden: true,
    },
    {
      key: "createdAt",
      label: "Created",
      type: "date-time",
      format: "date-time",
    },
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
  detailTitleField: "title",
  detailBlocks: [
    dataSourcesOverviewBlock,
    dataSourcesGateBlock,
    dataSourcesCuratedSourceBlock,
    dataSourcesContentBlock,
  ],
} satisfies DashboardViewInput;
