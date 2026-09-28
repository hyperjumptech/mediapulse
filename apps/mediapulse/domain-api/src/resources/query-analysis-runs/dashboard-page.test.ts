import { dashboardViewSchema } from "@hermes/domain-contract";
import { describe, expect, it } from "vitest";

import { queryAnalysisRunsDashboardPage } from "./dashboard-page";

describe("queryAnalysisRunsDashboardPage", () => {
  it("satisfies the Hermes dashboard view contract", () => {
    const parsed = dashboardViewSchema.safeParse(
      queryAnalysisRunsDashboardPage,
    );

    expect(parsed.success).toBe(true);
  });

  it("shows the ticker, the decision counts and when the run happened", () => {
    const keys = queryAnalysisRunsDashboardPage.columns.map(
      (column) => column.key,
    );

    expect(keys).toEqual([
      "tickerSymbol",
      "generated",
      "included",
      "rejected",
      "createdAt",
    ]);
  });

  it("keeps the execution id searchable without showing it as a column", () => {
    const keys = queryAnalysisRunsDashboardPage.columns.map(
      (column) => column.key,
    );

    expect(keys).not.toContain("executionId");
    expect(queryAnalysisRunsDashboardPage.searchableFields).toContain(
      "executionId",
    );
  });

  it("formats the decision counts as numbers", () => {
    const formats = queryAnalysisRunsDashboardPage.columns
      .filter((column) =>
        ["generated", "included", "rejected"].includes(column.key),
      )
      .map((column) => column.format);

    expect(formats).toEqual(["number", "number", "number"]);
  });
});
