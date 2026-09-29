import { dashboardViewSchema } from "@hermes/domain-contract";
import { describe, expect, it } from "vitest";

import { curatedSourcesDashboardPage } from "./dashboard-page";

const columnByKey = (key: string) =>
  curatedSourcesDashboardPage.columns.find((column) => column.key === key);

describe("curatedSourcesDashboardPage", () => {
  it("satisfies the Hermes dashboard view contract", () => {
    const parsed = dashboardViewSchema.safeParse(curatedSourcesDashboardPage);

    expect(parsed.success).toBe(true);
  });

  it("lists the source, its URL and how it is collected", () => {
    const keys = curatedSourcesDashboardPage.columns.map(
      (column) => column.key,
    );

    expect(keys).toEqual([
      "name",
      "listingUrl",
      "linkType",
      "enabled",
      "maxItems",
      "createdAt",
    ]);
  });

  it("shows the listing URL under the name on phones and hides it on small desktops", () => {
    expect(columnByKey("listingUrl")).toMatchObject({
      hideBelow: "md",
      mobile: "subtitle",
    });
  });

  it("renders the enabled flag as a boolean badge and the item cap as a number", () => {
    expect(columnByKey("enabled")).toMatchObject({
      format: "boolean",
      mobile: "badge",
    });
    expect(columnByKey("enabled")).not.toHaveProperty("badgeTones");
    expect(columnByKey("maxItems")?.format).toBe("number");
  });

  it("leaves the id, the name it is titled by and the created time off the detail page", () => {
    const [details] = curatedSourcesDashboardPage.detailBlocks;
    const fields =
      details?.type === "keyValue" ? details.rows.map((row) => row.field) : [];

    expect(fields).toEqual([
      "listingUrl",
      "linkType",
      "enabled",
      "maxItems",
      "updatedAt",
    ]);
  });
});
