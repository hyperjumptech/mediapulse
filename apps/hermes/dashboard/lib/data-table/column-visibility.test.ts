import { describe, expect, it } from "vitest";

import {
  columnVisibilityCookieName,
  mergeColumnVisibility,
  parseColumnVisibility,
  serializeColumnVisibility,
} from "./column-visibility";

describe("column visibility cookie", () => {
  it("names the cookie after the table", () => {
    expect(columnVisibilityCookieName("agents")).toBe("hermes_dt_agents");
  });

  it("round-trips through serialize and parse", () => {
    const visibility = { created: false, description: true };

    expect(
      parseColumnVisibility(serializeColumnVisibility(visibility)),
    ).toEqual(visibility);
  });

  it("ignores missing, malformed and non-object values", () => {
    expect(parseColumnVisibility(undefined)).toEqual({});
    expect(parseColumnVisibility("")).toEqual({});
    expect(parseColumnVisibility("%7Bnot-json")).toEqual({});
    expect(parseColumnVisibility(encodeURIComponent("[true]"))).toEqual({});
    expect(parseColumnVisibility(encodeURIComponent("null"))).toEqual({});
  });

  it("drops entries that are not booleans", () => {
    const raw = encodeURIComponent(
      JSON.stringify({ created: false, name: "yes", size: 3 }),
    );

    expect(parseColumnVisibility(raw)).toEqual({ created: false });
  });

  it("lets saved choices override the table defaults", () => {
    expect(
      mergeColumnVisibility(
        { created: false, createdBy: false },
        { created: true },
      ),
    ).toEqual({ created: true, createdBy: false });
  });
});
