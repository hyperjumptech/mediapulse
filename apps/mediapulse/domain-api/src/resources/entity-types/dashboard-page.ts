/**
 * Hermes `table-v1` manifest slice for the entity-types resource: labels, columns, sort/search fields,
 * and create/update JSON Schema metadata. Also exports the URL path segment constant for this resource.
 */

import { type DashboardViewInput } from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";
import { entityTypesCustomActionsForManifest } from "./custom-actions";
import {
  entityTypeCreateFormJsonSchema,
  entityTypeUpdateFormJsonSchema,
} from "./write-body-schemas";

/** URL path segment for this resource under `/v1/hermes-dashboard/`. */
export const entityTypesHermesPathSegment = "entity-types" as const;

/** Hermes `table-v1` manifest page for entity types. */
export const entityTypesDashboardPage = {
  id: entityTypesHermesPathSegment,
  label: "Entity Types",
  description:
    "Admin-managed entity classification vocabulary used by the analysis agent extraction prompts.",
  pathSegment: entityTypesHermesPathSegment,
  kind: "resource-table" as const,
  placement: "sidebar" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(entityTypesHermesPathSegment),
  order: 20,
  columns: columnsFor<ListItem>()([
    { key: "name", label: "Name", type: "text" },
    { key: "description", label: "Description", type: "text" },
    { key: "createdAt", label: "Created", type: "date-time" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()(["name", "description"]),
  sortableFields: rowFieldKeysFor<ListItem>()(["name", "createdAt"]),
  actions: { create: true, update: true, delete: true, view: false },
  createSchema: entityTypeCreateFormJsonSchema,
  updateSchema: entityTypeUpdateFormJsonSchema,
  customActions: entityTypesCustomActionsForManifest,
} satisfies DashboardViewInput;
