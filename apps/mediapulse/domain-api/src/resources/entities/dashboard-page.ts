/**
 * Hermes `table-v1` manifest for canonical knowledge-graph entities (read-only list + detail).
 */

import type { DashboardPageInput } from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";
import { entitiesCustomActionsForManifest } from "./custom-actions";

/** URL path segment for this resource under `/v1/hermes-dashboard/`. */
export const entitiesHermesPathSegment = "entities" as const;

/** Hermes `table-v1` manifest page for KG entities. */
export const entitiesDashboardPage = {
  id: entitiesHermesPathSegment,
  label: "Entities",
  description:
    "Canonical knowledge-graph entities extracted from collected articles by the analysis agent (read-only).",
  pathSegment: entitiesHermesPathSegment,
  template: "table-v1" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(entitiesHermesPathSegment),
  order: 32,
  columns: columnsFor<ListItem>()([
    { key: "canonicalName", label: "Name", type: "text" },
    { key: "entityTypeName", label: "Type", type: "text" },
    { key: "descriptionPreview", label: "Description", type: "text" },
    { key: "createdAt", label: "Created", type: "date-time" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()([
    "canonicalName",
    "entityTypeName",
    "descriptionPreview",
  ]),
  sortableFields: rowFieldKeysFor<ListItem>()([
    "canonicalName",
    "entityTypeName",
    "createdAt",
  ]),
  actions: { create: false, update: false, delete: false, view: true },
  customActions: entitiesCustomActionsForManifest,
} satisfies DashboardPageInput;
