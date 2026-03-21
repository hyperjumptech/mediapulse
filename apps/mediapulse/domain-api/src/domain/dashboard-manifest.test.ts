/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { dashboardManifest } from "./dashboard-manifest";
import { HermesDashboardResource } from "./hermes-dashboard-paths";

describe("dashboardManifest", () => {
  it("lists every Hermes table-v1 page using HermesDashboardResource segments", () => {
    // Act
    const byId = new Map(dashboardManifest.pages.map((p) => [p.id, p]));

    // Assert
    expect(byId.get(HermesDashboardResource.tickers)?.pathSegment).toBe(
      HermesDashboardResource.tickers,
    );
    expect(byId.get(HermesDashboardResource.mediapulseUsers)?.pathSegment).toBe(
      HermesDashboardResource.mediapulseUsers,
    );
    expect(byId.get(HermesDashboardResource.entityTypes)?.pathSegment).toBe(
      HermesDashboardResource.entityTypes,
    );
    expect(byId.get(HermesDashboardResource.relationTypes)?.pathSegment).toBe(
      HermesDashboardResource.relationTypes,
    );
    expect(byId.get(HermesDashboardResource.searchQueries)?.pathSegment).toBe(
      HermesDashboardResource.searchQueries,
    );
    expect(
      byId.get(HermesDashboardResource.dataSourceExpansions)?.pathSegment,
    ).toBe(HermesDashboardResource.dataSourceExpansions);
    expect(dashboardManifest.templateVersion).toBe(1);
  });
});
