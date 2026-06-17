/**
 * Hermes `table-v1` manifest slice for relation-types: UI metadata for the dashboard table and exported path segment.
 */

import { type DashboardViewInput } from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";
import { relationTypesCustomActionsForManifest } from "./custom-actions";
import {
  relationTypeCreateFormJsonSchema,
  relationTypeUpdateFormJsonSchema,
} from "./write-body-schemas";

/** URL path segment for this resource under `/v1/hermes-dashboard/`. */
export const relationTypesHermesPathSegment = "relation-types" as const;

/** Hermes `table-v1` manifest page for relation types. */
export const relationTypesDashboardPage = {
  id: relationTypesHermesPathSegment,
  label: "Relation Types",
  description:
    "Admin-managed relation classification vocabulary used by the analysis agent extraction prompts.",
  pathSegment: relationTypesHermesPathSegment,
  kind: "resource-table" as const,
  placement: "sidebar" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(relationTypesHermesPathSegment),
  order: 30,
  columns: columnsFor<ListItem>()([
    { key: "name", label: "Name", type: "text" },
    { key: "description", label: "Description", type: "text" },
    { key: "createdAt", label: "Created", type: "date-time" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()(["name", "description"]),
  sortableFields: rowFieldKeysFor<ListItem>()(["name", "createdAt"]),
  actions: { create: true, update: true, delete: true, view: false },
  createSchema: relationTypeCreateFormJsonSchema,
  updateSchema: relationTypeUpdateFormJsonSchema,
  customActions: relationTypesCustomActionsForManifest,
} satisfies DashboardViewInput;
