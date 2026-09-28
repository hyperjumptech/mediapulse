import { dashboardViewSchema } from "@hermes/domain-contract";
import { describe, expect, it } from "vitest";

import { dataSourcesDashboardPage } from "./dashboard-page";

const columnByKey = (key: string) =>
  dataSourcesDashboardPage.columns.find((column) => column.key === key);

describe("dataSourcesDashboardPage", () => {
  it("satisfies the Hermes dashboard view contract", () => {
    const parsed = dashboardViewSchema.safeParse(dataSourcesDashboardPage);

    expect(parsed.success).toBe(true);
  });

  it("lists the ticker, the article and how it was collected", () => {
    const keys = dataSourcesDashboardPage.columns.map((column) => column.key);

    expect(keys).toEqual([
      "tickerSymbol",
      "title",
      "url",
      "searchQueryText",
      "collectionSourceLabel",
      "collectionGateStatusLabel",
      "createdAt",
    ]);
  });

  it("drops the content preview and character count columns", () => {
    const keys = dataSourcesDashboardPage.columns.map((column) => column.key);

    expect(keys).not.toContain("contentPreview");
    expect(keys).not.toContain("contentLength");
  });

  it("hides the URL and search query below large screens and on phones", () => {
    const hints = ["url", "searchQueryText"].map((key) => {
      const column = columnByKey(key);

      return { hideBelow: column?.hideBelow, mobile: column?.mobile };
    });

    expect(hints).toEqual([
      { hideBelow: "lg", mobile: "hidden" },
      { hideBelow: "lg", mobile: "hidden" },
    ]);
  });

  it("keeps the collection gate available but hidden by default", () => {
    expect(columnByKey("collectionGateStatusLabel")).toMatchObject({
      format: "badge",
      badgeTones: { Passed: "success", Failed: "failed" },
      defaultHidden: true,
    });
  });
});
