/**
 * Hermes `table-v1` manifest for knowledge-graph entity relations (read-only list + detail).
 */

import type { DashboardPageInput } from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";

/** URL path segment for this resource under `/v1/hermes-dashboard/`. */
export const entityRelationsHermesPathSegment = "entity-relations" as const;

/** Hermes `table-v1` manifest page for KG entity relations (edges). */
export const entityRelationsDashboardPage = {
  id: entityRelationsHermesPathSegment,
  label: "Entity relations",
  description: "Directed typed edges between canonical entities (read-only).",
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
  actions: { create: false, update: false, delete: false, view: true },
} satisfies DashboardPageInput;
