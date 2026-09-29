import type { DashboardViewInput, DetailBlock } from "@hermes/domain-contract";

import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  createdAtDateRangeListFilter,
  tickerIdSelectListFilter,
} from "../../hermes-dashboard/templates/table-v1/list-filter-definitions";
import {
  columnsFor,
  rowFieldKeysFor,
  type ManifestColumnBadgeTones,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import {
  DAY1_DISPATCH_KIND_LABELS,
  DAY1_DISPATCH_STATUS_LABELS,
  type ListItem,
} from "./list-mapper";

export const day1DispatchesHermesPathSegment = "day1-dispatches" as const;

export const DAY1_DISPATCHES_ORDER = 57;

export const day1DispatchKindBadgeTones = {
  "Full chain": "neutral",
  "Latest issue": "neutral",
  None: "muted",
} as const satisfies ManifestColumnBadgeTones;

export const day1DispatchStatusBadgeTones = {
  Dispatching: "progress",
  Fired: "success",
  Failed: "failed",
  Skipped: "muted",
} as const satisfies ManifestColumnBadgeTones;

const toStaticOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

const day1DispatchDetailBlock = {
  type: "keyValue",
  rows: [
    {
      field: "subscriberEmail",
      label: "Subscriber",
      linkTemplate: "/dashboard/{integrationId}/mediapulse-users/{userId}",
      copyAction: true,
    },
    { field: "tickerSymbol", label: "Ticker" },
    { field: "language", label: "Language" },
    { field: "kind", label: "Pipeline" },
    { field: "status", label: "Status" },
    { field: "reason", label: "Skip reason" },
    { field: "error", label: "Error" },
    {
      field: "hermesExecutionId",
      label: "Hermes run",
      linkTemplate: "/dashboard/executions/{hermesExecutionId}",
      copyAction: true,
    },
    { field: "createdAt", label: "Decided", format: "date-time" },
    { field: "updatedAt", label: "Updated", format: "date-time" },
  ],
} satisfies DetailBlock;

export const day1DispatchesDashboardPage = {
  id: day1DispatchesHermesPathSegment,
  label: "Day 1 Dispatches",
  description:
    "What happened when each new subscription became active: which day-1 pipeline ran, or why none did (read-only).",
  pathSegment: day1DispatchesHermesPathSegment,
  kind: "resource-table" as const,
  placement: "sidebar" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(day1DispatchesHermesPathSegment),
  order: DAY1_DISPATCHES_ORDER,
  columns: columnsFor<ListItem>()([
    { key: "tickerSymbol", label: "Ticker", type: "text" },
    {
      key: "subscriberEmail",
      label: "Subscriber",
      type: "text",
      mobile: "subtitle",
    },
    {
      key: "kind",
      label: "Pipeline",
      type: "text",
      format: "badge",
      badgeTones: day1DispatchKindBadgeTones,
    },
    {
      key: "status",
      label: "Status",
      type: "text",
      format: "badge",
      badgeTones: day1DispatchStatusBadgeTones,
      mobile: "badge",
    },
    {
      key: "reason",
      label: "Skip reason",
      type: "text",
      hideBelow: "lg",
      mobile: "hidden",
    },
    { key: "language", label: "Language", type: "text", hideBelow: "md" },
    {
      key: "createdAt",
      label: "Decided",
      type: "date-time",
      format: "date-time",
    },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()([
    "tickerSymbol",
    "subscriberEmail",
  ]),
  sortableFields: rowFieldKeysFor<ListItem>()(["createdAt"]),
  defaultSort: { sortBy: "createdAt", sortDir: "desc" },
  listFilters: [
    {
      key: "status",
      label: "Status",
      ui: "select",
      placeholderAll: "All statuses",
      staticOptions: toStaticOptions(DAY1_DISPATCH_STATUS_LABELS),
    },
    {
      key: "kind",
      label: "Pipeline",
      ui: "select",
      placeholderAll: "All pipelines",
      staticOptions: toStaticOptions(DAY1_DISPATCH_KIND_LABELS),
    },
    tickerIdSelectListFilter,
    createdAtDateRangeListFilter,
  ],
  actions: { create: false, update: false, delete: false, view: true },
  detailTitleField: "title",
  detailBlocks: [day1DispatchDetailBlock],
} satisfies DashboardViewInput;
