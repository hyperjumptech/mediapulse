/**
 * Hermes `table-v1` manifest slice for Mediapulse end users and exported `*HermesPathSegment` for routing.
 */

import type { DashboardViewInput } from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import { enabledBooleanSelectListFilter } from "../../hermes-dashboard/templates/table-v1/list-filter-definitions";
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
    { key: "createdAt", label: "Created", type: "date-time" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()(["email", "name"]),
  sortableFields: rowFieldKeysFor<ListItem>()([
    "email",
    "enabled",
    "createdAt",
  ]),
  listFilters: [enabledBooleanSelectListFilter],
  actions: { create: true, update: true, delete: true, view: false },
  createSchema: mediapulseUserCreateFormJsonSchema,
  updateSchema: mediapulseUserUpdateFormJsonSchema,
} satisfies DashboardViewInput;
