/**
 * Hermes `table-v1` manifest slice for Mediapulse end users and exported `*HermesPathSegment` for routing.
 */

import {
  dashboardObjectFormJsonSchemaForListRow,
  type DashboardPageInput,
} from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";

/** URL path segment for this resource under `/v1/hermes-dashboard/`. */
export const mediapulseUsersHermesPathSegment = "mediapulse-users" as const;

/** Hermes `table-v1` manifest page for Mediapulse end users. */
export const mediapulseUsersDashboardPage = {
  id: mediapulseUsersHermesPathSegment,
  label: "Mediapulse users",
  description:
    "End users and newsletter subscribers (distinct from Hermes dashboard admins).",
  pathSegment: mediapulseUsersHermesPathSegment,
  template: "table-v1" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(mediapulseUsersHermesPathSegment),
  order: 15,
  columns: columnsFor<ListItem>()([
    { key: "email", label: "Email", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "createdAt", label: "Created", type: "date-time" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()(["email", "name"]),
  sortableFields: rowFieldKeysFor<ListItem>()(["email", "createdAt"]),
  actions: { create: true, update: true, delete: true },
  createSchema: dashboardObjectFormJsonSchemaForListRow<ListItem>()({
    type: "object",
    required: ["email"],
    properties: {
      email: { type: "string", title: "Email", format: "email" },
      name: { type: "string", title: "Name" },
    },
  }),
  updateSchema: dashboardObjectFormJsonSchemaForListRow<ListItem>()({
    type: "object",
    required: ["email"],
    properties: {
      email: { type: "string", title: "Email", format: "email" },
      name: { type: "string", title: "Name" },
    },
  }),
} satisfies DashboardPageInput;
