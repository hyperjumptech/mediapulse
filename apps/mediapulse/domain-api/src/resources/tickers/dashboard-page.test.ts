import { dashboardViewSchema } from "@hermes/domain-contract";
import { describe, expect, it } from "vitest";

import { tickersDashboardPage } from "./dashboard-page";

describe("tickersDashboardPage", () => {
  it("satisfies the Hermes dashboard view contract", () => {
    const parsed = dashboardViewSchema.safeParse(tickersDashboardPage);

    expect(parsed.success).toBe(true);
  });

  it("lists the symbol, the company name and when it was created", () => {
    const keys = tickersDashboardPage.columns.map((column) => column.key);

    expect(keys).toEqual(["symbol", "name", "createdAt"]);
  });

  it("shows the company name under the symbol on phones", () => {
    const name = tickersDashboardPage.columns.find(
      (column) => column.key === "name",
    );

    expect(name?.mobile).toBe("subtitle");
  });
});
