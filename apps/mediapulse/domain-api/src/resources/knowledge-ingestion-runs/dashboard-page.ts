import type { DashboardViewInput, DetailBlock } from "@hermes/domain-contract";

import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import { knowledgeIngestionRunStatusSelectListFilter } from "../../hermes-dashboard/templates/table-v1/list-filter-definitions";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";

export const knowledgeIngestionRunsHermesPathSegment =
  "knowledge-ingestion-runs" as const;

const runOutcomeBlock = {
  type: "panel",
  label: "Run",
  sectionRule: {
    when: "skippedNoAnchors > 0",
    badge: "muted",
    label: "sources skipped",
  },
  blocks: [
    {
      type: "statCards",
      cards: [
        { label: "Considered", field: "considered" },
        { label: "Citations added", field: "citationsAdded" },
        { label: "Attach rate", field: "attachRate" },
        { label: "Duration", field: "durationLabel" },
      ],
    },
    {
      type: "statCards",
      cards: [
        { label: "Storylines opened", field: "storylinesOpened" },
        { label: "Developments opened", field: "developmentsOpened" },
        { label: "Storylines locked", field: "storylinesLocked" },
        { label: "Skipped, no anchors", field: "skippedNoAnchors" },
      ],
    },
    {
      type: "keyValue",
      rows: [
        { field: "status", label: "Status" },
        { field: "startedAt", label: "Started", format: "date-time" },
        { field: "completedAt", label: "Completed", format: "date-time" },
        { field: "watermarkAt", label: "Watermark", format: "date-time" },
        { field: "agentVersion", label: "Agent version" },
        { field: "stopReason", label: "Stop reason" },
        {
          field: "scheduleExecutionId",
          label: "Schedule execution",
          copyAction: true,
        },
      ],
    },
  ],
} satisfies DetailBlock;

const runDevelopmentsBlock = {
  type: "subTable",
  label: "Developments written",
  field: "developments",
  rowLimitOptions: [10, 25],
  emptyState: "This run opened no developments.",
  captionTemplate: "{developments.length} developments written by this run.",
  columns: [
    {
      field: "title",
      label: "Development",
      type: "text",
      truncate: 120,
      minWidth: 320,
    },
    {
      field: "storylineName",
      label: "Storyline",
      type: "text",
      truncate: 80,
      linkTemplate: "/dashboard/{integrationId}/storylines/{storylineId}",
    },
    { field: "citationCount", label: "Citations", type: "text" },
    { field: "observedAt", label: "Observed", type: "date-time" },
  ],
} satisfies DetailBlock;

export const knowledgeIngestionRunsDashboardPage = {
  id: knowledgeIngestionRunsHermesPathSegment,
  label: "Knowledge Ingestion Runs",
  description:
    "Per-run chronicle from the knowledge-ingestion agent: how many Data Sources it considered, how many storylines and developments it opened, and how many it skipped for want of anchors (read-only). Open a row to see the developments that run wrote.",
  pathSegment: knowledgeIngestionRunsHermesPathSegment,
  kind: "resource-table" as const,
  placement: "sidebar" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(
    knowledgeIngestionRunsHermesPathSegment,
  ),
  order: 46,
  columns: columnsFor<ListItem>()([
    { key: "startedAt", label: "Started", type: "date-time" },
    { key: "status", label: "Status", type: "text" },
    { key: "considered", label: "Considered", type: "text" },
    { key: "storylinesOpened", label: "Storylines", type: "text" },
    { key: "developmentsOpened", label: "Developments", type: "text" },
    { key: "citationsAdded", label: "Citations", type: "text" },
    { key: "skippedNoAnchors", label: "Skipped", type: "text" },
    { key: "durationLabel", label: "Duration", type: "text" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()([]),
  sortableFields: rowFieldKeysFor<ListItem>()(["startedAt"]),
  defaultSort: { sortBy: "startedAt", sortDir: "desc" as const },
  listFilters: [knowledgeIngestionRunStatusSelectListFilter],
  detailBlocks: [runOutcomeBlock, runDevelopmentsBlock],
  actions: { create: false, update: false, delete: false, view: true },
} satisfies DashboardViewInput;
