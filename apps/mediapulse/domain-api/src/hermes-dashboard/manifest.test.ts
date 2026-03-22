/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { dashboardManifest } from "./manifest";
import { HermesDashboardResource } from "./paths";
import { hermesDashboardResources } from "./hermes-dashboard-resource-registry";

describe("dashboardManifest", () => {
  it("matches the registered resource list order and ids", () => {
    // Setup
    const sorted = [...hermesDashboardResources].sort(
      (a, b) => a.order - b.order,
    );

    // Act
    const pageIds = dashboardManifest.pages.map((p) => p.id);

    // Assert
    expect(pageIds).toEqual(sorted.map((r) => r.dashboardPage.id));
    expect(dashboardManifest.templateVersion).toBe(1);
  });

  it("uses unique path segments for every page", () => {
    // Setup
    const segments = dashboardManifest.pages.map((p) => p.pathSegment);

    // Assert
    expect(new Set(segments).size).toBe(segments.length);
  });

  it("maps every HermesDashboardResource entry to a manifest page with matching id", () => {
    // Act & Assert
    for (const key of Object.keys(
      HermesDashboardResource,
    ) as (keyof typeof HermesDashboardResource)[]) {
      const segment = HermesDashboardResource[key];
      const page = dashboardManifest.pages.find(
        (p) => p.pathSegment === segment,
      );
      expect(page, `missing page for ${String(key)}`).toBeDefined();
      expect(page?.id).toBe(segment);
      expect(page?.pathSegment).toBe(segment);
    }
  });

  it("keeps manifest page order monotonic by page order field", () => {
    // Setup
    const orders = dashboardManifest.pages.map((p) => p.order);

    // Assert
    const sorted = [...orders].sort((a, b) => a - b);
    expect(orders).toEqual(sorted);
  });
});
