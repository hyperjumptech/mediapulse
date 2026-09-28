import { dashboardViewSchema } from "@hermes/domain-contract";
import { describe, expect, it } from "vitest";

import { searchQueriesDashboardPage } from "./dashboard-page";

const columnByKey = (key: string) =>
  searchQueriesDashboardPage.columns.find((column) => column.key === key);

describe("searchQueriesDashboardPage", () => {
  it("satisfies the Hermes dashboard view contract", () => {
    const parsed = dashboardViewSchema.safeParse(searchQueriesDashboardPage);

    expect(parsed.success).toBe(true);
  });

  it("lists the ticker, the query and its place in the active set", () => {
    const keys = searchQueriesDashboardPage.columns.map((column) => column.key);

    expect(keys).toEqual([
      "tickerSymbol",
      "text",
      "activeSet",
      "intent",
      "rank",
      "createdAt",
    ]);
  });

  it("drops the generation pipeline column", () => {
    const keys = searchQueriesDashboardPage.columns.map((column) => column.key);

    expect(keys).not.toContain("generationPipeline");
  });

  it("shows the query text under the ticker on phones", () => {
    expect(columnByKey("text")).toMatchObject({
      label: "Search query",
      mobile: "subtitle",
    });
  });

  it("renders active-set membership as a toned badge and the rank as a number", () => {
    expect(columnByKey("activeSet")).toMatchObject({
      format: "badge",
      badgeTones: { Yes: "success", No: "muted" },
      mobile: "badge",
    });
    expect(columnByKey("rank")?.format).toBe("number");
  });
});
