/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { dashboardManifest } from "../hermes-dashboard/manifest";
import {
  HermesDashboardResource,
  hermesDashboardManifestApiPrefix,
  hermesDashboardTableMountPath,
  type HermesDashboardSegment,
} from "../hermes-dashboard/paths";
import { hermesDashboardRouteMounts } from "./hermes-dashboard-route-mounts";

describe("Hermes dashboard routing contract", () => {
  it("registers an HTTP mount for every table-v1 manifest page", () => {
    // Setup
    const mountSegments = new Set(
      hermesDashboardRouteMounts.map((m) => m.segment),
    );
    const tablePages = dashboardManifest.pages.filter(
      (p) => p.template === "table-v1",
    );

    // Act & Assert
    for (const page of tablePages) {
      expect(
        mountSegments.has(page.pathSegment as HermesDashboardSegment),
      ).toBe(true);
    }
  });

  it("has a manifest table-v1 page for every mounted Hermes table segment", () => {
    // Setup
    const segmentsFromManifest = new Set(
      dashboardManifest.pages
        .filter((p) => p.template === "table-v1")
        .map((p) => p.pathSegment),
    );

    // Act & Assert
    for (const { segment } of hermesDashboardRouteMounts) {
      expect(segmentsFromManifest.has(segment)).toBe(true);
    }
  });

  it("builds manifest apiPrefix from pathSegment for every table-v1 page", () => {
    // Act & Assert
    for (const page of dashboardManifest.pages.filter(
      (p) => p.template === "table-v1",
    )) {
      expect(page.apiPrefix).toBe(
        hermesDashboardManifestApiPrefix(
          page.pathSegment as HermesDashboardSegment,
        ),
      );
    }
  });

  it("keeps page id equal to pathSegment for every table-v1 page", () => {
    // Act & Assert
    for (const page of dashboardManifest.pages.filter(
      (p) => p.template === "table-v1",
    )) {
      expect(page.id).toBe(page.pathSegment);
    }
  });

  it("exposes stable resource keys on HermesDashboardResource", () => {
    // Assert — breaks if segments are renamed without updating mounts + manifest
    expect(HermesDashboardResource.tickers).toBe("tickers");
    expect(HermesDashboardResource.mediapulseUsers).toBe("mediapulse-users");
    expect(HermesDashboardResource.dataSources).toBe("data-sources");
    expect(hermesDashboardTableMountPath(HermesDashboardResource.tickers)).toBe(
      "/hermes-dashboard/tickers",
    );
    expect(
      hermesDashboardTableMountPath(HermesDashboardResource.dataSources),
    ).toBe("/hermes-dashboard/data-sources");
  });
});
