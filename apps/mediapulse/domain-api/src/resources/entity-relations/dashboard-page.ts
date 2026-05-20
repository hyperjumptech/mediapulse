/**
 * Hermes `table-v1` manifest for knowledge-graph entity relations (CRUD list + detail).
 */

import type { DashboardPageInput } from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import { entityRelationsCustomActionsForManifest } from "./custom-actions";
import type { ListItem } from "./list-mapper";
import {
  entityRelationCreateFormJsonSchema,
  entityRelationUpdateFormJsonSchema,
} from "./write-body-schemas";

/** URL path segment for this resource under `/v1/hermes-dashboard/`. */
export const entityRelationsHermesPathSegment = "entity-relations" as const;

/** Hermes `table-v1` manifest page for KG entity relations (edges). */
export const entityRelationsDashboardPage = {
  id: entityRelationsHermesPathSegment,
  label: "Entity relations",
  description:
    "Directed typed edges between canonical entities. Create, edit, or delete edges; use Reset all to wipe the graph.",
  pathSegment: entityRelationsHermesPathSegment,
  template: "table-v1" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(entityRelationsHermesPathSegment),
  order: 33,
  columns: columnsFor<ListItem>()([
    { key: "fromEntityName", label: "From", type: "text" },
    { key: "toEntityName", label: "To", type: "text" },
    { key: "relationTypeName", label: "Relation type", type: "text" },
    { key: "weight", label: "Weight", type: "text" },
    { key: "lastSeenAt", label: "Last seen", type: "date-time" },
    { key: "createdAt", label: "Created", type: "date-time" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()([
    "fromEntityName",
    "toEntityName",
    "relationTypeName",
  ]),
  sortableFields: rowFieldKeysFor<ListItem>()([
    "fromEntityName",
    "toEntityName",
    "relationTypeName",
    "weight",
    "lastSeenAt",
    "createdAt",
  ]),
  actions: { create: true, update: true, delete: true, view: true },
  createSchema: entityRelationCreateFormJsonSchema,
  updateSchema: entityRelationUpdateFormJsonSchema,
  customActions: entityRelationsCustomActionsForManifest,
} satisfies DashboardPageInput;
