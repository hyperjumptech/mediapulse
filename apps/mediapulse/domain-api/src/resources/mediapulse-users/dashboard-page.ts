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

export const mediapulseUsersHermesPathSegment = "mediapulse-users" as const;

const mediapulseUsersMetadataBlock = {
  type: "keyValue",
  rows: [
    { field: "name", label: "Name" },
    { field: "enabled", label: "Enabled" },
    { field: "createdAt", label: "Created", format: "date-time" },
  ],
} satisfies DetailBlock;

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
    { key: "name", label: "Name", type: "text", mobile: "subtitle" },
    { key: "enabled", label: "Enabled", type: "text", format: "boolean" },
    { key: "languages", label: "Language", type: "text" },
    {
      key: "createdAt",
      label: "Created",
      type: "date-time",
      format: "date-time",
    },
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
