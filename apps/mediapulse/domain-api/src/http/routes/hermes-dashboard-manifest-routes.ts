import { Hono } from "hono";
import { dashboardManifest } from "../../hermes-dashboard/manifest";
import { buildMetaPayloadForPathSegment } from "../../hermes-dashboard/templates/table-v1/meta-for-path-segment";

/**
 * Hermes dashboard manifest and per-resource table metadata (`table-v1` contract).
 */
export const hermesDashboardManifestRoutes = new Hono();

hermesDashboardManifestRoutes.get("/manifest", (c) => {
  return c.json(dashboardManifest);
});

hermesDashboardManifestRoutes.get("/:resource/meta", (c) => {
  const resource = c.req.param("resource");
  const meta = buildMetaPayloadForPathSegment(resource);
  if (!meta) {
    return c.json({ message: "Unknown dashboard resource" }, 404);
  }

  return c.json(meta);
});
