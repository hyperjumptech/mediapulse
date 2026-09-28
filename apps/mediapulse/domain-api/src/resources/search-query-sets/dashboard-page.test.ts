import { dashboardViewSchema } from "@hermes/domain-contract";
import { describe, expect, it } from "vitest";

import { searchQuerySetsDashboardPage } from "./dashboard-page";

const columnByKey = (key: string) =>
  searchQuerySetsDashboardPage.columns.find((column) => column.key === key);

describe("searchQuerySetsDashboardPage", () => {
  it("satisfies the Hermes dashboard view contract", () => {
    const parsed = dashboardViewSchema.safeParse(searchQuerySetsDashboardPage);

    expect(parsed.success).toBe(true);
  });

  it("declares full-page CRUD and detail blocks", () => {
    expect(searchQuerySetsDashboardPage.createNavigation).toBe("full-page");
    expect(searchQuerySetsDashboardPage.actions.view).toBe(true);
    expect(searchQuerySetsDashboardPage.detailBlocks?.length).toBeGreaterThan(
      0,
    );
  });

  it("includes a queries subTable block", () => {
    const block = searchQuerySetsDashboardPage.detailBlocks?.find(
      (entry) => entry.type === "subTable" && entry.field === "queries",
    );

    expect(block).toBeDefined();
  });

  it("lists the ticker, whether the set is active, and how it was generated", () => {
    const keys = searchQuerySetsDashboardPage.columns.map(
      (column) => column.key,
    );

    expect(keys).toEqual([
      "tickerSymbol",
      "tickerName",
      "isActive",
      "generatedAt",
      "generationSource",
      "queryCount",
    ]);
  });

  it("keeps the job id searchable and the created time sortable without columns", () => {
    const keys = searchQuerySetsDashboardPage.columns.map(
      (column) => column.key,
    );

    expect(keys).not.toContain("agentJobId");
    expect(keys).not.toContain("createdAt");
    expect(searchQuerySetsDashboardPage.searchableFields).toContain(
      "agentJobId",
    );
    expect(searchQuerySetsDashboardPage.sortableFields).toContain("createdAt");
  });

  it("puts the ticker name under the symbol on phones", () => {
    expect(columnByKey("tickerName")).toMatchObject({ mobile: "subtitle" });
  });

  it("renders the active flag as a boolean badge", () => {
    expect(columnByKey("isActive")).toMatchObject({
      format: "boolean",
      mobile: "badge",
    });
  });

  it("formats the query count as a number", () => {
    expect(columnByKey("queryCount")?.format).toBe("number");
  });
});
