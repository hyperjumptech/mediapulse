import type {
  DashboardColumnTone,
  DashboardViewInput,
} from "@hermes/domain-contract";
import type { DeliveryRunOutcome } from "@mediapulse/database";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";
import { deliveryRunsCustomActionsForManifest } from "./custom-actions";

export const deliveryRunsHermesPathSegment = "delivery-runs" as const;

export const deliveryRunOutcomeBadgeTones = {
  success: "success",
  partial_success: "warning",
  failed: "failed",
  skipped: "muted",
  skipped_all_already_delivered: "muted",
} as const satisfies Record<DeliveryRunOutcome, DashboardColumnTone>;

export const deliveryRunsDashboardPage = {
  id: deliveryRunsHermesPathSegment,
  label: "Delivery Runs",
  description:
    "Diagnostic records written by the delivery agent for each newsletter send attempt (read-only).",
  pathSegment: deliveryRunsHermesPathSegment,
  kind: "resource-table" as const,
  placement: "sidebar" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(deliveryRunsHermesPathSegment),
  order: 55,
  columns: columnsFor<ListItem>()([
    { key: "tickerSymbol", label: "Ticker", type: "text" },
    {
      key: "outcome",
      label: "Outcome",
      type: "text",
      format: "badge",
      badgeTones: deliveryRunOutcomeBadgeTones,
      mobile: "badge",
    },
    { key: "successCount", label: "OK", type: "text", format: "number" },
    { key: "failureCount", label: "Failed", type: "text", format: "number" },
    { key: "skippedCount", label: "Skipped", type: "text", format: "number" },
    {
      key: "durationMs",
      label: "Duration",
      type: "text",
      format: "duration-ms",
    },
    {
      key: "runSkipReason",
      label: "Skip reason",
      type: "text",
      hideBelow: "md",
    },
    {
      key: "recipientErrorSummary",
      label: "Error summary",
      type: "text",
      hideBelow: "lg",
      mobile: "hidden",
    },
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
    "outcome",
    "jobId",
    "runSkipReason",
    "recipientErrorSummary",
  ]),
  sortableFields: rowFieldKeysFor<ListItem>()(["createdAt", "outcome"]),
  actions: { create: false, update: false, delete: false, view: true },
  customActions: deliveryRunsCustomActionsForManifest,
} satisfies DashboardViewInput;
