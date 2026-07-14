/**
 * Hermes `table-v1` manifest slice for Mediapulse end users and exported `*HermesPathSegment` for routing.
 */

import type { DashboardViewInput, DetailBlock } from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  enabledBooleanSelectListFilter,
  languageSelectListFilter,
} from "../../hermes-dashboard/templates/table-v1/list-filter-definitions";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";
import {
  mediapulseUserCreateFormJsonSchema,
  mediapulseUserUpdateFormJsonSchema,
} from "./write-body-schemas";

/** URL path segment for this resource under `/v1/hermes-dashboard/`. */
export const mediapulseUsersHermesPathSegment = "mediapulse-users" as const;

/** User profile fields shown above the subscriptions sub-table on the detail page. */
const mediapulseUsersMetadataBlock = {
  type: "keyValue",
  label: "User",
  rows: [
    { field: "id", label: "User id", copyAction: true },
    { field: "email", label: "Email", copyAction: true },
    { field: "name", label: "Name" },
    { field: "enabled", label: "Enabled" },
    { field: "createdAt", label: "Created", format: "date-time" },
    { field: "updatedAt", label: "Updated", format: "date-time" },
  ],
} satisfies DetailBlock;

/** Per-ticker subscription rows bound to `subscriptions` on the detail payload. */
const mediapulseUsersSubscriptionsBlock = {
  type: "subTable",
  label: "Subscriptions",
  field: "subscriptions",
  emptyState: "No ticker subscriptions.",
  columns: [
    { field: "tickerSymbol", label: "Ticker", type: "text" },
    { field: "tickerName", label: "Name", type: "text" },
    { field: "language", label: "Language", type: "text" },
    { field: "enabled", label: "Enabled", type: "text" },
    {
      field: "registrationConfirmedAt",
      label: "Confirmed",
      type: "date-time",
    },
    { field: "unsubscribedAt", label: "Unsubscribed", type: "date-time" },
    { field: "unsubscribeMethod", label: "Unsubscribe method", type: "text" },
  ],
} satisfies DetailBlock;

/** Hermes `table-v1` manifest page for Mediapulse end users. */
export const mediapulseUsersDashboardPage = {
  id: mediapulseUsersHermesPathSegment,
  label: "Mediapulse Users",
  description:
    "End-user newsletter subscribers; admin-created in Hermes (distinct from dashboard admins).",
  pathSegment: mediapulseUsersHermesPathSegment,
  kind: "resource-table" as const,
  placement: "sidebar" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(mediapulseUsersHermesPathSegment),
  order: 15,
  columns: columnsFor<ListItem>()([
    { key: "email", label: "Email", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "enabled", label: "Enabled", type: "text" },
    { key: "languages", label: "Language", type: "text" },
    { key: "createdAt", label: "Created", type: "date-time" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()(["email", "name"]),
  sortableFields: rowFieldKeysFor<ListItem>()([
    "email",
    "enabled",
    "createdAt",
  ]),
  listFilters: [enabledBooleanSelectListFilter, languageSelectListFilter],
  actions: { create: true, update: true, delete: true, view: true },
  createSchema: mediapulseUserCreateFormJsonSchema,
  updateSchema: mediapulseUserUpdateFormJsonSchema,
  detailBlocks: [
    mediapulseUsersMetadataBlock,
    mediapulseUsersSubscriptionsBlock,
  ],
} satisfies DashboardViewInput;
