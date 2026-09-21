import type { DashboardViewInput, DetailBlock } from "@hermes/domain-contract";

import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  createdAtDateRangeListFilter,
  extractionRunStatusSelectListFilter,
  tickerIdSelectListFilter,
} from "../../hermes-dashboard/templates/table-v1/list-filter-definitions";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";

export const knowledgeExtractionRunsHermesPathSegment =
  "knowledge-extraction-runs" as const;

const overviewBlock = {
  type: "panel",
  label: "Run",
  blocks: [
    {
      type: "statCards",
      cards: [
        { label: "Articles read", field: "header.consideredLabel" },
        { label: "Entities created", field: "header.entitiesLabel" },
        { label: "Mentions written", field: "header.mentionsLabel" },
        {
          label: "Claims refused",
          field: "header.rejectionLabel",
          colorField: "header.rejectionVariant",
        },
      ],
    },
    {
      type: "keyValue",
      rows: [
        { field: "tickerSymbol", label: "Issuer" },
        { field: "status", label: "Status" },
        { field: "header.durationLabel", label: "Duration" },
        { field: "header.perArticleLabel", label: "Pace" },
        { field: "startedAt", label: "Started", format: "date-time" },
        { field: "completedAt", label: "Completed", format: "date-time" },
        { field: "watermarkAt", label: "Watermark", format: "date-time" },
        { field: "agentVersion", label: "Agent version" },
        { field: "stopReason", label: "Stop reason" },
        { field: "scheduleExecutionId", label: "Schedule execution" },
      ],
    },
  ],
} satisfies DetailBlock;

const countersBlock = {
  type: "subTable",
  label: "Counters",
  field: "counters",
  hideHeader: true,
  emptyState: "This run recorded no counters.",
  columns: [
    { field: "label", label: "Counter", type: "text", minWidth: 280 },
    { field: "value", label: "Value", type: "text" },
  ],
} satisfies DetailBlock;

export const knowledgeExtractionRunsDashboardPage = {
  id: knowledgeExtractionRunsHermesPathSegment,
  label: "Extraction Runs",
  description:
    "Per-issuer chronicle of knowledge extraction: what each run read, what it wrote, and what its guards refused (read-only). A high refused share means the prompt is the problem rather than the corpus.",
  pathSegment: knowledgeExtractionRunsHermesPathSegment,
  kind: "resource-table" as const,
  placement: "sidebar" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(
    knowledgeExtractionRunsHermesPathSegment,
  ),
  order: 45,
  columns: columnsFor<ListItem>()([
    { key: "tickerSymbol", label: "Issuer", type: "text" },
    { key: "status", label: "Status", type: "text" },
    { key: "considered", label: "Read", type: "text" },
    { key: "entitiesCreated", label: "Entities", type: "text" },
    { key: "mentionsWritten", label: "Mentions", type: "text" },
    { key: "kindsCreated", label: "New kinds", type: "text" },
    { key: "rejectionRate", label: "Refused", type: "text" },
    { key: "durationLabel", label: "Duration", type: "text" },
    { key: "startedAt", label: "Started", type: "date-time" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()(["tickerSymbol"]),
  sortableFields: rowFieldKeysFor<ListItem>()(["startedAt"]),
  defaultSort: { sortBy: "startedAt", sortDir: "desc" as const },
  detailTitleField: "title",
  listFilters: [
    extractionRunStatusSelectListFilter,
    tickerIdSelectListFilter,
    createdAtDateRangeListFilter,
  ],
  detailBlocks: [overviewBlock, countersBlock],
  actions: { create: false, update: false, delete: false, view: true },
} satisfies DashboardViewInput;
