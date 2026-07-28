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
    const tablePages = dashboardManifest.views.filter(
      (p) => p.kind === "resource-table",
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
      dashboardManifest.views
        .filter((p) => p.kind === "resource-table")
        .map((p) => p.pathSegment),
    );

    // Act & Assert
    for (const { segment } of hermesDashboardRouteMounts) {
      expect(segmentsFromManifest.has(segment)).toBe(true);
    }
  });

  it("builds manifest apiPrefix from pathSegment for every table-v1 page", () => {
    // Act & Assert
    for (const page of dashboardManifest.views.filter(
      (p) => p.kind === "resource-table",
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
    for (const page of dashboardManifest.views.filter(
      (p) => p.kind === "resource-table",
    )) {
      expect(page.id).toBe(page.pathSegment);
    }
  });

  it("exposes stable resource keys on HermesDashboardResource", () => {
    // Assert — breaks if segments are renamed without updating mounts + manifest
    expect(HermesDashboardResource.tickers).toBe("tickers");
    expect(HermesDashboardResource.tickerProfiles).toBe("ticker-profiles");
    expect(HermesDashboardResource.mediapulseUsers).toBe("mediapulse-users");
    expect(HermesDashboardResource.entities).toBe("entities");
    expect(HermesDashboardResource.entityRelations).toBe("entity-relations");
    expect(HermesDashboardResource.dataSources).toBe("data-sources");
    expect(HermesDashboardResource.searchQuerySets).toBe("search-query-sets");
    expect(HermesDashboardResource.deliveryRuns).toBe("delivery-runs");
    expect(hermesDashboardTableMountPath(HermesDashboardResource.tickers)).toBe(
      "/hermes-dashboard/tickers",
    );
    expect(
      hermesDashboardTableMountPath(HermesDashboardResource.dataSources),
    ).toBe("/hermes-dashboard/data-sources");
    expect(
      hermesDashboardTableMountPath(HermesDashboardResource.entities),
    ).toBe("/hermes-dashboard/entities");
    expect(
      hermesDashboardTableMountPath(HermesDashboardResource.entityRelations),
    ).toBe("/hermes-dashboard/entity-relations");
  });
});
