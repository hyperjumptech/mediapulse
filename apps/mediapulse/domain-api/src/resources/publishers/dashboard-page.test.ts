import { dashboardViewSchema } from "@hermes/domain-contract";
import { describe, expect, it } from "vitest";

import {
  publisherNameSourceSelectListFilter,
  publishersDashboardPage,
} from "./dashboard-page";

describe("publishersDashboardPage", () => {
  it("satisfies the Hermes dashboard view contract", () => {
    const parsed = dashboardViewSchema.safeParse(publishersDashboardPage);

    expect(parsed.success).toBe(true);
  });

  it("lists the byline name first so it titles the detail page", () => {
    const keys = publishersDashboardPage.columns.map((column) => column.key);

    expect(keys).toEqual([
      "displayName",
      "domain",
      "nameSourceLabel",
      "lastSeenAt",
    ]);
  });

  it("only allows editing, since collection creates every row", () => {
    expect(publishersDashboardPage.actions).toEqual({
      create: false,
      update: true,
      delete: false,
      view: true,
    });
  });

  it("edits the display name and nothing else", () => {
    const properties = Object.keys(
      (publishersDashboardPage.updateSchema as { properties: object })
        .properties,
    );

    expect(properties).toEqual(["displayName"]);
  });

  it("offers every name source as a filter option", () => {
    const values = publisherNameSourceSelectListFilter.staticOptions.map(
      (option) => option.value,
    );

    expect(values).toEqual(["manual", "site_metadata", "llm", "derived"]);
  });
});
