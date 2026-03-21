import { tableV1MetaResponseSchema } from "@hermes/domain-contract";
import { Hono } from "hono";
import { dashboardManifest } from "../../domain/dashboard-manifest";

/**
 * Hermes dashboard manifest and per-resource table metadata (`table-v1` contract).
 */
export const hermesDashboardManifestRoutes = new Hono();

hermesDashboardManifestRoutes.get("/manifest", (c) => {
  return c.json(dashboardManifest);
});

hermesDashboardManifestRoutes.get("/:resource/meta", (c) => {
  const resource = c.req.param("resource");
  const page = dashboardManifest.pages.find(
    (entry) => entry.pathSegment === resource,
  );
  if (!page) {
    return c.json({ message: "Unknown dashboard resource" }, 404);
  }

  const meta = tableV1MetaResponseSchema.parse({
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

  return c.json(meta);
});
