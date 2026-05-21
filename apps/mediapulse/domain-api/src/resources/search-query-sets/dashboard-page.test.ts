/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { searchQuerySetsDashboardPage } from "./dashboard-page";

describe("searchQuerySetsDashboardPage", () => {
  it("declares full-page CRUD and detail blocks", () => {
    // Assert
    expect(searchQuerySetsDashboardPage.createNavigation).toBe("full-page");
    expect(searchQuerySetsDashboardPage.actions.view).toBe(true);
    expect(searchQuerySetsDashboardPage.detailBlocks?.length).toBeGreaterThan(
      0,
    );
  });

  it("includes a queries subTable block", () => {
    // Act
    const block = searchQuerySetsDashboardPage.detailBlocks?.find(
      (entry) => entry.type === "subTable" && entry.field === "queries",
    );

    // Assert
    expect(block).toBeDefined();
  });
});
