/**
 * Hermes `table-v1` manifest for canonical knowledge-graph entities (read-only list + detail).
 */

import type { DashboardPageInput, DetailBlock } from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  createdAtDateRangeListFilter,
  entityTypeIdSelectListFilter,
  tickerIdSelectListFilter,
} from "../../hermes-dashboard/templates/table-v1/list-filter-definitions";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";
import { entitiesCustomActionsForManifest } from "./custom-actions";

/** URL path segment for this resource under `/v1/hermes-dashboard/`. */
export const entitiesHermesPathSegment = "entities" as const;

const entitiesMetadataBlock = {
  type: "keyValue",
  label: "Metadata",
  rows: [
    { field: "id", label: "Entity id", copyAction: true },
    { field: "canonicalName", label: "Name", copyAction: true },
    { field: "entityTypeName", label: "Type" },
    { field: "typeId", label: "Type id", copyAction: true },
    { field: "createdAt", label: "Created", format: "date-time" },
    { field: "updatedAt", label: "Updated", format: "date-time" },
  ],
} satisfies DetailBlock;

const entitiesDescriptionBlock = {
  type: "markdown",
  label: "Description",
  field: "description",
} satisfies DetailBlock;

const entitiesEvidenceBlock = {
  type: "subTable",
  label: "Evidence",
  field: "evidence",
  captionTemplate: "Evidence ({evidence.length} sources)",
  emptyState: "No provenance evidence recorded for this entity.",
  columns: [
    {
      field: "title",
      label: "Source",
      type: "text",
      truncate: 80,
      linkTemplate: "/dashboard/{integrationId}/data-sources/{id}",
    },
    { field: "confidence", label: "Confidence", type: "number" },
    { field: "lastSeenAt", label: "Last seen", type: "date-time" },
  ],
} satisfies DetailBlock;

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
  defaultSort: { sortBy: "createdAt", sortDir: "desc" },
  listFilters: [
    tickerIdSelectListFilter,
    entityTypeIdSelectListFilter,
    createdAtDateRangeListFilter,
  ],
  actions: { create: false, update: false, delete: false, view: true },
  customActions: entitiesCustomActionsForManifest,
  detailBlocks: [
    entitiesMetadataBlock,
    entitiesDescriptionBlock,
    entitiesEvidenceBlock,
  ],
} satisfies DashboardPageInput;
