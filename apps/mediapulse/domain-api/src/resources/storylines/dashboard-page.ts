import type { DashboardViewInput, DetailBlock } from "@hermes/domain-contract";

import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  lastObservedAtDateRangeListFilter,
  lockedBooleanSelectListFilter,
  storylineKindSelectListFilter,
  tickerIdSelectListFilter,
} from "../../hermes-dashboard/templates/table-v1/list-filter-definitions";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";

export const storylinesHermesPathSegment = "storylines" as const;

const storylinesOverviewBlock = {
  type: "panel",
  label: "Storyline",
  sectionRule: { when: "locked == true", badge: "warning", label: "locked" },
  blocks: [
    {
      type: "statCards",
      cards: [
        { label: "Kind", field: "header.kindLabel" },
        { label: "Developments", field: "header.developmentsLabel" },
        { label: "Citations", field: "header.citationsLabel" },
        {
          label: "Status",
          field: "header.lockedLabel",
          colorField: "header.lockedVariant",
        },
      ],
    },
    {
      type: "keyValue",
      rows: [
        { field: "header.windowLabel", label: "Observed window" },
        { field: "header.tickersLabel", label: "Linked tickers" },
        { field: "lockedReason", label: "Lock reason" },
        { field: "lockedAt", label: "Locked at", format: "date-time" },
      ],
    },
  ],
} satisfies DetailBlock;

const storylinesGraphBlock = {
  type: "graph",
  label: "Knowledge graph",
  nodesField: "graph.nodes",
  edgesField: "graph.edges",
  orientation: "horizontal",
  maxNodes: 220,
  maxHeight: 560,
  node: {
    idField: "id",
    labelField: "label",
    groupField: "group",
    tooltipField: "tooltip",
    rankField: "rank",
    orderField: "order",
    emphasisField: "emphasis",
    linkTemplate: "/dashboard/{integrationId}/{linkResource}/{linkId}",
  },
  edge: { sourceField: "source", targetField: "target", labelField: "label" },
  groupVariants: {
    ticker: "accent2",
    storyline: "accent1",
    development: "accent3",
    source: "accent4",
    overflow: "neutral",
  },
  captionTemplate:
    "{graph.nodes.length} nodes · {graph.edges.length} connections. {graph.truncatedLabel}",
  emptyState: "No developments recorded for this storyline yet.",
} satisfies DetailBlock;

const storylinesEvidenceBlock = {
  type: "tabs",
  label: "Evidence",
  tabs: [
    {
      label: "Developments",
      countField: "developments",
      block: {
        type: "subTable",
        field: "developments",
        rowLimitOptions: [10, 25],
        emptyState: "No developments recorded yet.",
        columns: [
          {
            field: "title",
            label: "Development",
            type: "text",
            truncate: 120,
            descriptionField: "evidenceLabel",
            minWidth: 320,
          },
          { field: "observedAt", label: "Observed", type: "date-time" },
          { field: "citationCount", label: "Citations", type: "text" },
        ],
      },
    },
    {
      label: "Citations",
      countField: "citations",
      block: {
        type: "subTable",
        field: "citations",
        rowLimitOptions: [10, 25],
        emptyState: "No articles cite this storyline yet.",
        columns: [
          {
            field: "title",
            label: "Article",
            type: "text",
            truncate: 120,
            minWidth: 320,
            linkTemplate:
              "/dashboard/{integrationId}/data-sources/{dataSourceId}",
            descriptionField: "url",
            descriptionLinkTemplate: "{url}",
            linkExternal: false,
          },
          { field: "publisher", label: "Publisher", type: "text", muted: true },
          {
            field: "developmentTitle",
            label: "Development",
            type: "text",
            truncate: 80,
            muted: true,
          },
        ],
      },
    },
    {
      label: "Tickers",
      countField: "tickers",
      block: {
        type: "subTable",
        field: "tickers",
        emptyState: "No ticker is linked to this storyline.",
        columns: [
          {
            field: "symbol",
            label: "Ticker",
            type: "text",
            linkTemplate: "/dashboard/{integrationId}/tickers/{tickerId}",
            descriptionField: "name",
          },
          { field: "sourceLabel", label: "Linked by", type: "text" },
          { field: "createdAt", label: "Linked at", type: "date-time" },
        ],
      },
    },
    {
      label: "Anchors",
      countField: "anchors",
      block: {
        type: "subTable",
        field: "anchors",
        hideHeader: true,
        rowLimitOptions: [25, 50],
        emptyState: "This storyline has no anchors.",
        columns: [{ field: "anchor", label: "Anchor", type: "text" }],
      },
    },
  ],
} satisfies DetailBlock;

export const storylinesDashboardPage = {
  id: storylinesHermesPathSegment,
  label: "Storylines",
  description:
    "Threads the knowledge-ingestion agent opened over the article corpus: each storyline, the developments beneath it, and the articles citing them (read-only). Open a row to see the knowledge graph and the attach evidence.",
  pathSegment: storylinesHermesPathSegment,
  kind: "resource-table" as const,
  placement: "sidebar" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(storylinesHermesPathSegment),
  order: 45,
  columns: columnsFor<ListItem>()([
    { key: "name", label: "Storyline", type: "text" },
    { key: "kindLabel", label: "Kind", type: "text" },
    { key: "tickerSymbols", label: "Tickers", type: "text" },
    { key: "developmentCount", label: "Developments", type: "text" },
    { key: "citationCount", label: "Citations", type: "text" },
    { key: "lockedLabel", label: "Status", type: "text" },
    { key: "lastObservedAt", label: "Last observed", type: "date-time" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()(["name"]),
  sortableFields: rowFieldKeysFor<ListItem>()([
    "lastObservedAt",
    "firstObservedAt",
    "name",
    "developmentCount",
  ]),
  defaultSort: { sortBy: "lastObservedAt", sortDir: "desc" as const },
  detailTitleField: "name",
  listFilters: [
    storylineKindSelectListFilter,
    lockedBooleanSelectListFilter,
    tickerIdSelectListFilter,
    lastObservedAtDateRangeListFilter,
  ],
  detailBlocks: [
    storylinesOverviewBlock,
    storylinesGraphBlock,
    storylinesEvidenceBlock,
  ],
  actions: { create: false, update: false, delete: false, view: true },
} satisfies DashboardViewInput;
