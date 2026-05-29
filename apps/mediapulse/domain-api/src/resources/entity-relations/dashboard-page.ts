/**
 * Hermes `table-v1` manifest for knowledge-graph entity relations (CRUD list + detail).
 */

import type { DashboardPageInput, DetailBlock } from "@hermes/domain-contract";
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

const entityRelationsMetadataBlock = {
  type: "keyValue",
  label: "Metadata",
  rows: [
    { field: "id", label: "Relation id", copyAction: true },
    {
      field: "fromEntityName",
      label: "From",
      linkTemplate: "/dashboard/{integrationId}/entities/{fromEntityId}",
    },
    {
      field: "toEntityName",
      label: "To",
      linkTemplate: "/dashboard/{integrationId}/entities/{toEntityId}",
    },
    { field: "relationTypeName", label: "Relation type" },
    { field: "weight", label: "Weight", format: "text" },
    { field: "lastSeenAt", label: "Last seen", format: "date-time" },
    { field: "createdAt", label: "Created", format: "date-time" },
  ],
} satisfies DetailBlock;

const entityRelationsEvidenceBlock = {
  type: "subTable",
  label: "Evidence",
  field: "evidence",
  captionTemplate: "Evidence ({evidence.length} sources)",
  emptyState: "No provenance evidence recorded for this relation.",
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

/** Hermes `table-v1` manifest page for KG entity relations (edges). */
export const entityRelationsDashboardPage = {
  id: entityRelationsHermesPathSegment,
  label: "Entity Relations",
  description:
    "Directed typed edges between entities, extracted from articles by the analysis agent. Create, edit, or delete manually; use Reset all to wipe the graph.",
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
  detailBlocks: [entityRelationsMetadataBlock, entityRelationsEvidenceBlock],
} satisfies DashboardPageInput;
