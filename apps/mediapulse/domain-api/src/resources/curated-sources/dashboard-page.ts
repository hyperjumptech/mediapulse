/**
 * Hermes `table-v1` manifest slice for curated sources: labels, columns, filters, and create/update JSON Schema metadata.
 */

import type { DashboardViewInput, DetailBlock } from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  createdAtDateRangeListFilter,
  enabledBooleanSelectListFilter,
} from "../../hermes-dashboard/templates/table-v1/list-filter-definitions";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";
import {
  curatedSourceCreateFormJsonSchema,
  curatedSourceUpdateFormJsonSchema,
} from "./write-body-schemas";

/** URL path segment for this resource under `/v1/hermes-dashboard/`. */
export const curatedSourcesHermesPathSegment = "curated-sources" as const;

const curatedSourcesMetadataBlock = {
  type: "keyValue",
  label: "Metadata",
  rows: [
    { field: "id", label: "Source id", copyAction: true },
    { field: "name", label: "Name" },
    {
      field: "listingUrl",
      label: "Listing URL",
      linkTemplate: "{listingUrl}",
      copyAction: true,
    },
    { field: "linkType", label: "Link type", format: "text" },
    { field: "enabled", label: "Enabled", format: "text" },
    { field: "maxItems", label: "Max items", format: "text" },
    { field: "createdAt", label: "Created", format: "date-time" },
    { field: "updatedAt", label: "Updated", format: "date-time" },
  ],
} satisfies DetailBlock;

/** Hermes `table-v1` manifest page for curated sources. */
export const curatedSourcesDashboardPage = {
  id: curatedSourcesHermesPathSegment,
  label: "Curated Sources",
  description:
    "Operator-managed URLs for page-collection. Choose Page for a single article URL or Listing for RSS, sitemap, or HTML listing pages.",
  pathSegment: curatedSourcesHermesPathSegment,
  kind: "resource-table" as const,
  placement: "sidebar" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(curatedSourcesHermesPathSegment),
  order: 15,
  columns: columnsFor<ListItem>()([
    { key: "name", label: "Name", type: "text" },
    { key: "listingUrl", label: "Listing URL", type: "text" },
    { key: "linkType", label: "Link type", type: "text" },
    { key: "enabled", label: "Enabled", type: "text" },
    { key: "maxItems", label: "Max items", type: "text" },
    { key: "createdAt", label: "Created", type: "date-time" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()(["name", "listingUrl"]),
  sortableFields: rowFieldKeysFor<ListItem>()([
    "name",
    "listingUrl",
    "linkType",
    "enabled",
    "maxItems",
    "createdAt",
  ]),
  defaultSort: { sortBy: "createdAt", sortDir: "desc" },
  listFilters: [enabledBooleanSelectListFilter, createdAtDateRangeListFilter],
  actions: { create: true, update: true, delete: true, view: true },
  createSchema: curatedSourceCreateFormJsonSchema,
  updateSchema: curatedSourceUpdateFormJsonSchema,
  detailBlocks: [curatedSourcesMetadataBlock],
} satisfies DashboardViewInput;
