import type { DashboardPageInput } from "@hermes/domain-contract";
import {
  HermesDashboardResource,
  hermesDashboardManifestApiPrefix,
} from "../../hermes-dashboard/paths";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";

/** Hermes `table-v1` manifest page for Mediapulse end users. */
export const mediapulseUsersDashboardPage = {
  id: HermesDashboardResource.mediapulseUsers,
  label: "Mediapulse users",
  description:
    "End users and newsletter subscribers (distinct from Hermes dashboard admins).",
  pathSegment: HermesDashboardResource.mediapulseUsers,
  template: "table-v1" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(
    HermesDashboardResource.mediapulseUsers,
  ),
  order: 15,
  columns: columnsFor<ListItem>()([
    { key: "email", label: "Email", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "createdAt", label: "Created", type: "date-time" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()(["email", "name"]),
  sortableFields: rowFieldKeysFor<ListItem>()(["email", "createdAt"]),
  actions: { create: true, update: true, delete: true },
  createSchema: {
    type: "object",
    required: ["email"],
    properties: {
      email: { type: "string", title: "Email", format: "email" },
      name: { type: "string", title: "Name" },
    },
  },
  updateSchema: {
    type: "object",
    required: ["email"],
    properties: {
      email: { type: "string", title: "Email", format: "email" },
      name: { type: "string", title: "Name" },
    },
  },
} satisfies DashboardPageInput;
