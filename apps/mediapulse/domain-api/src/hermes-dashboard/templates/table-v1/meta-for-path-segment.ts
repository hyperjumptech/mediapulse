import { tableV1MetaResponseSchema } from "@hermes/domain-contract";

import { dashboardManifest } from "../../manifest";

/**
 * Builds the validated `table-v1` meta JSON for a dashboard manifest page.
 *
 * Used by both `/v1/hermes-dashboard/:resource/meta` and per-table mounts that
 * define `GET /:id` (which would otherwise capture the `meta` path segment).
 *
 * @param pathSegment - Manifest page {@link dashboardManifest} `pathSegment`.
 * @returns Parsed meta payload, or `null` when no page matches.
 */
export const buildMetaPayloadForPathSegment = (
  pathSegment: string,
): ReturnType<typeof tableV1MetaResponseSchema.parse> | null => {
  const page = dashboardManifest.views.find(
    (entry) =>
      entry.placement === "sidebar" &&
      entry.pathSegment === pathSegment &&
      entry.kind === "resource-table",
  );
  if (!page || page.kind !== "resource-table") {
    return null;
  }

  return tableV1MetaResponseSchema.parse({
    title: page.label,
    description: page.description,
    columns: page.columns,
    searchableFields: page.searchableFields,
    sortableFields: page.sortableFields,
    actions: page.actions,
    createSchema: page.createSchema,
    updateSchema: page.updateSchema,
    customActions: page.customActions,
    createNavigation: page.createNavigation,
    preview: page.preview,
    detailBlocks: page.detailBlocks,
    defaultSort: page.defaultSort,
    listFilters: page.listFilters,
    detailTitleField: page.detailTitleField,
  });
};
