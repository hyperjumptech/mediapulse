import { tableV1MetaResponseSchema } from "@hermes/domain-contract";

import { dashboardManifest } from "./dashboard-manifest";

/**
 * Builds the validated `table-v1` meta JSON for a dashboard manifest page.
 *
 * Used by both `/v1/hermes-dashboard/:resource/meta` and per-table mounts that
 * define `GET /:id` (which would otherwise capture the `meta` path segment).
 *
 * @param pathSegment - Manifest page {@link dashboardManifest} `pathSegment`.
 * @returns Parsed meta payload, or `null` when no page matches.
 */
export const buildTableV1MetaPayloadForPathSegment = (
  pathSegment: string,
): ReturnType<typeof tableV1MetaResponseSchema.parse> | null => {
  const page = dashboardManifest.pages.find(
    (entry) => entry.pathSegment === pathSegment,
  );
  if (!page) {
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
  });
};
