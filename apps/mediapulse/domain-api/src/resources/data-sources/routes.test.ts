/**
 * Route wiring for data-sources: `GET /meta` must not be captured by `GET /:id`.
 */

/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { dataSourcesRoutes } from "./routes";

describe("dataSourcesRoutes", () => {
  it("serves GET /meta with table-v1 meta JSON (not 404 from id lookup)", async () => {
    const res = await dataSourcesRoutes.request("http://localhost/meta", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { title?: string };
    expect(body.title).toBe("Data sources");
  });
});
