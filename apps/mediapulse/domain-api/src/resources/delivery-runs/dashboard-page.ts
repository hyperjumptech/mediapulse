import type { DashboardPageInput } from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";
import { deliveryRunsCustomActionsForManifest } from "./custom-actions";

/** URL path segment for this resource under `/v1/hermes-dashboard/`. */
export const deliveryRunsHermesPathSegment = "delivery-runs" as const;

/** Hermes `table-v1` manifest for read-only delivery diagnostics. */
export const deliveryRunsDashboardPage = {
  id: deliveryRunsHermesPathSegment,
  label: "Delivery Runs",
  description:
    "Diagnostic records written by the delivery agent for each newsletter send attempt (read-only).",
  pathSegment: deliveryRunsHermesPathSegment,
  template: "table-v1" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(deliveryRunsHermesPathSegment),
  order: 55,
  columns: columnsFor<ListItem>()([
    { key: "tickerSymbol", label: "Ticker", type: "text" },
    { key: "outcome", label: "Outcome", type: "text" },
    { key: "jobId", label: "Job id", type: "text" },
    { key: "runSkipReason", label: "Skip reason", type: "text" },
    { key: "successCount", label: "OK", type: "text" },
    { key: "failureCount", label: "Failed", type: "text" },
    { key: "skippedCount", label: "Skipped", type: "text" },
    { key: "durationMs", label: "Duration ms", type: "text" },
    { key: "recipientErrorSummary", label: "Error summary", type: "text" },
    { key: "createdAt", label: "Created", type: "date-time" },
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
} satisfies DashboardPageInput;
