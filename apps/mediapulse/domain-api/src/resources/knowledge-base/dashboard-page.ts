import type {
  DashboardViewInput,
  DetailBlock,
  detailBlockSchema,
} from "@hermes/domain-contract";
import type { z } from "zod";

import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";

type DetailBlockInput = z.input<typeof detailBlockSchema>;

export const knowledgeBaseHermesPathSegment = "knowledge-base" as const;

const knowledgeBaseOverviewBlock = {
  type: "panel",
  label: "Knowledge base",
  blocks: [
    {
      type: "statCards",
      cards: [
        { label: "Entities", field: "header.entitiesLabel" },
        { label: "Relations", field: "header.relationsLabel" },
        { label: "Articles", field: "header.articlesLabel" },
        {
          label: "Grounding",
          field: "header.groundingLabel",
          colorField: "header.groundingVariant",
        },
      ],
    },
    {
      type: "keyValue",
      rows: [
        { field: "name", label: "Issuer" },
        {
          field: "header.lastSeenLabel",
          label: "Last seen",
          format: "date-time",
        },
      ],
    },
  ],
} satisfies DetailBlock;

const knowledgeBaseGraphBlock = {
  type: "graph",
  label: "Knowledge graph",
  nodesField: "graph.nodes",
  edgesField: "graph.edges",
  maxNodes: 150,
  maxHeight: 620,
  node: {
    idField: "id",
    labelField: "label",
    groupField: "group",
    tooltipField: "tooltip",
    rankField: "rank",
    orderField: "order",
    emphasisField: "emphasis",
    linkTemplate: "/dashboard/{integrationId}/{linkResource}/{linkId}",
    detailFields: [
      { label: "Kind", field: "kindLabel" },
      { label: "Articles", field: "mentionCount", format: "number" },
      { label: "Seen as", field: "seenAs" },
      { label: "Came from", field: "sourceLabel" },
      { label: "Publisher", field: "publisher" },
      { label: "Published", field: "publishedAt", format: "date-time" },
      { label: "URL", field: "url", format: "url" },
    ],
  },
  edge: { sourceField: "source", targetField: "target", labelField: "label" },
  groupVariants: {
    ticker: "accent2",
    company: "accent1",
    regulator: "accent3",
    person: "accent5",
    article: "accent4",
    other: "neutral",
    overflow: "neutral",
  },
  captionTemplate:
    "{graph.nodes.length} nodes · {graph.edges.length} connections. {graph.truncatedLabel}",
  emptyState: "No entities recorded for this issuer yet.",
} satisfies DetailBlockInput;

const knowledgeBaseEvidenceBlock = {
  type: "tabs",
  label: "Evidence",
  tabs: [
    {
      label: "Entities",
      countField: "entities",
      block: {
        type: "subTable",
        field: "entities",
        rowLimitOptions: [10, 25],
        emptyState: "No entities recorded yet.",
        columns: [
          {
            field: "canonicalName",
            label: "Entity",
            type: "text",
            minWidth: 240,
            descriptionField: "aliases",
          },
          { field: "kindLabel", label: "Kind", type: "text" },
          { field: "mentionCount", label: "Articles", type: "text" },
          {
            field: "sourceLabel",
            label: "Came from",
            type: "text",
            muted: true,
          },
          { field: "lastSeenAt", label: "Last seen", type: "date-time" },
        ],
      },
    },
    {
      label: "Relations",
      countField: "relations",
      block: {
        type: "subTable",
        field: "relations",
        rowLimitOptions: [10, 25],
        emptyState: "No relations recorded yet.",
        columns: [
          { field: "subject", label: "Subject", type: "text", minWidth: 180 },
          {
            field: "predicate",
            label: "Relation",
            type: "text",
            descriptionField: "emittedLabel",
          },
          { field: "object", label: "Object", type: "text", minWidth: 180 },
          { field: "curatedLabel", label: "Kind", type: "text", muted: true },
          { field: "observations", label: "Seen", type: "text" },
          {
            field: "evidenceSpan",
            label: "Evidence",
            type: "text",
            truncate: 160,
            minWidth: 320,
            muted: true,
          },
          {
            field: "sourceLabel",
            label: "Came from",
            type: "text",
            muted: true,
          },
        ],
      },
    },
    {
      label: "Articles",
      countField: "articles",
      block: {
        type: "subTable",
        field: "articles",
        rowLimitOptions: [10, 25],
        emptyState: "No article names any of these entities yet.",
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
            field: "entityNames",
            label: "Names",
            type: "text",
            truncate: 80,
            muted: true,
          },
          { field: "publishedAt", label: "Published", type: "date-time" },
        ],
      },
    },
  ],
} satisfies DetailBlock;

export const knowledgeBaseDashboardPage = {
  id: knowledgeBaseHermesPathSegment,
  label: "Knowledge Base",
  description:
    "One issuer's entities and the relations between them, drawn from its Ticker Profile and from what its articles state (read-only). Open a row to see the issuer's graph and the evidence behind every edge.",
  pathSegment: knowledgeBaseHermesPathSegment,
  kind: "resource-table" as const,
  placement: "sidebar" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(knowledgeBaseHermesPathSegment),
  order: 44,
  columns: columnsFor<ListItem>()([
    { key: "symbol", label: "Ticker", type: "text" },
    {
      key: "name",
      label: "Issuer",
      type: "text",
      hideBelow: "md",
      mobile: "subtitle",
    },
    { key: "entityCount", label: "Entities", type: "text", format: "number" },
    {
      key: "relationCount",
      label: "Relations",
      type: "text",
      format: "number",
    },
    { key: "articleCount", label: "Articles", type: "text", format: "number" },
    {
      key: "lastSeenAt",
      label: "Last seen",
      type: "date-time",
      format: "date-time",
    },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()(["symbol", "name"]),
  sortableFields: rowFieldKeysFor<ListItem>()([
    "symbol",
    "name",
    "entityCount",
    "lastSeenAt",
  ]),
  defaultSort: { sortBy: "symbol", sortDir: "asc" as const },
  detailTitleField: "title",
  detailBlocks: [
    knowledgeBaseOverviewBlock,
    knowledgeBaseGraphBlock,
    knowledgeBaseEvidenceBlock,
  ],
  actions: { create: false, update: false, delete: false, view: true },
} satisfies DashboardViewInput;
