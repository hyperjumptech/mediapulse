import { dashboardViewSchema } from "@hermes/domain-contract";
import { describe, expect, it } from "vitest";

import { tickerProfilesDashboardPage } from "./dashboard-page";

const columnByKey = (key: string) =>
  tickerProfilesDashboardPage.columns.find((column) => column.key === key);

describe("tickerProfilesDashboardPage", () => {
  it("satisfies the Hermes dashboard view contract", () => {
    const parsed = dashboardViewSchema.safeParse(tickerProfilesDashboardPage);

    expect(parsed.success).toBe(true);
  });

  it("lists the issuer, its classification and competitors in scan order", () => {
    const keys = tickerProfilesDashboardPage.columns.map(
      (column) => column.key,
    );

    expect(keys).toEqual([
      "symbol",
      "name",
      "sector",
      "subSector",
      "industry",
      "competitors",
      "updatedAt",
    ]);
  });

  it("drops the finer classification and the competitor list first as the screen narrows", () => {
    const breakpoints = ["sector", "subSector", "industry", "competitors"].map(
      (key) => columnByKey(key)?.hideBelow,
    );

    expect(breakpoints).toEqual(["md", "xl", "lg", "xl"]);
  });

  it("starts with the competitor list hidden so the table fits beside the sidebar", () => {
    expect(columnByKey("competitors")?.defaultHidden).toBe(true);
  });

  it("keeps phone cards to the name, sector and update time", () => {
    const hidden = tickerProfilesDashboardPage.columns
      .filter((column) => column.mobile === "hidden")
      .map((column) => column.key);

    expect(columnByKey("name")?.mobile).toBe("subtitle");
    expect(hidden).toEqual(["subSector", "industry", "competitors"]);
  });
});
