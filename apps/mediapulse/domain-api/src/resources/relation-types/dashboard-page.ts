/**
 * Hermes `table-v1` manifest slice for relation-types: UI metadata for the dashboard table and exported path segment.
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
export const relationTypesHermesPathSegment = "relation-types" as const;

/** Hermes `table-v1` manifest page for relation types. */
export const relationTypesDashboardPage = {
  id: relationTypesHermesPathSegment,
  label: "Relation Types",
  description:
    "Manage vocabulary used by the knowledge graph relation classifier.",
  pathSegment: relationTypesHermesPathSegment,
  template: "table-v1" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(relationTypesHermesPathSegment),
  order: 30,
  columns: columnsFor<ListItem>()([
    { key: "name", label: "Name", type: "text" },
    { key: "description", label: "Description", type: "text" },
    { key: "createdAt", label: "Created", type: "date-time" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()(["name", "description"]),
  sortableFields: rowFieldKeysFor<ListItem>()(["name", "createdAt"]),
  actions: { create: true, update: true, delete: true },
  createSchema: dashboardObjectFormJsonSchemaForListRow<ListItem>()({
    type: "object",
    required: ["name"],
    properties: {
      name: { type: "string", title: "Name" },
      description: { type: "string", title: "Description" },
    },
  }),
  updateSchema: dashboardObjectFormJsonSchemaForListRow<ListItem>()({
    type: "object",
    required: ["name"],
    properties: {
      name: { type: "string", title: "Name" },
      description: { type: "string", title: "Description" },
    },
  }),
} satisfies DashboardPageInput;
