/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { dataSourceExpansionsRoutes } from "./data-source-expansions-routes";

describe("dataSourceExpansionsRoutes", () => {
  it("exposes GET /meta so :id does not capture the meta segment", async () => {
    // Act
    const res = await dataSourceExpansionsRoutes.request(
      "http://localhost/meta",
      {
        method: "GET",
      },
    );

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as { title?: string };
    expect(body.title).toBe("Data source expansions");
  });
});
