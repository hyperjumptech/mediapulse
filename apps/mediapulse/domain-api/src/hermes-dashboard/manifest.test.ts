/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { dataSourceExpansionsDashboardPage } from "../resources/data-source-expansions/dashboard-page";
import { entityTypesDashboardPage } from "../resources/entity-types/dashboard-page";
import { mediapulseUsersDashboardPage } from "../resources/mediapulse-users/dashboard-page";
import { relationTypesDashboardPage } from "../resources/relation-types/dashboard-page";
import { searchQueriesDashboardPage } from "../resources/search-queries/dashboard-page";
import { tickersDashboardPage } from "../resources/tickers/dashboard-page";
import { dashboardManifest } from "./manifest";
import { HermesDashboardResource } from "./paths";

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

  it("keeps manifest page order aligned with table module composition", () => {
    expect(dashboardManifest.pages).toEqual([
      expect.objectContaining({ id: tickersDashboardPage.id }),
      expect.objectContaining({ id: mediapulseUsersDashboardPage.id }),
      expect.objectContaining({ id: entityTypesDashboardPage.id }),
      expect.objectContaining({ id: relationTypesDashboardPage.id }),
      expect.objectContaining({ id: searchQueriesDashboardPage.id }),
      expect.objectContaining({ id: dataSourceExpansionsDashboardPage.id }),
    ]);
  });
});
