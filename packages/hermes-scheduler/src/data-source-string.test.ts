/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  isAllowlisted,
  isDataSourceString,
  parseDataSourceString,
} from "./data-source-string";

describe("isDataSourceString", () => {
  it("returns true for valid data source string", () => {
    expect(isDataSourceString("db:ticker:all:id")).toBe(true);
    expect(isDataSourceString("db:ticker:all:id?batchSize=10")).toBe(true);
  });

  it("returns false for non-string", () => {
    expect(isDataSourceString(123)).toBe(false);
    expect(isDataSourceString(null)).toBe(false);
    expect(isDataSourceString({})).toBe(false);
  });

  it("returns false for string that does not match format", () => {
    expect(isDataSourceString("ticker:all")).toBe(false);
    expect(isDataSourceString("db:ticker:all")).toBe(false);
  });
});

describe("parseDataSourceString", () => {
  it("parses db:table:filter:field without query", () => {
    const r = parseDataSourceString("db:ticker:all:id");
    expect(r).not.toBeNull();
    expect(r?.source).toBe("db");
    expect(r?.table).toBe("ticker");
    expect(r?.filter).toBe("all");
    expect(r?.field).toBe("id");
    expect(r?.filters).toEqual({});
  });

  it("parses with batchSize and staggerDelay", () => {
    const r = parseDataSourceString(
      "db:ticker:all:id?batchSize=10&staggerDelay=2000",
    );
    expect(r).not.toBeNull();
    expect(r?.batchSize).toBe(10);
    expect(r?.staggerDelay).toBe(2000);
  });

  it("parses simple filter in query", () => {
    const r = parseDataSourceString("db:ticker:all:id?enabled=true");
    expect(r).not.toBeNull();
    expect(r?.filters).toEqual({ enabled: "true" });
  });

  it("returns null for invalid format", () => {
    expect(parseDataSourceString("invalid")).toBeNull();
    expect(parseDataSourceString("db:ticker:all")).toBeNull();
  });
});

describe("isAllowlisted", () => {
  it("returns true for ticker and id", () => {
    expect(
      isAllowlisted({
        source: "db",
        table: "ticker",
        filter: "all",
        field: "id",
        filters: {},
      }),
    ).toBe(true);
  });

  it("returns true for ticker and symbol", () => {
    expect(
      isAllowlisted({
        source: "db",
        table: "ticker",
        filter: "all",
        field: "symbol",
        filters: {},
      }),
    ).toBe(true);
  });

  it("returns false for unknown table", () => {
    expect(
      isAllowlisted({
        source: "db",
        table: "users",
        filter: "all",
        field: "id",
        filters: {},
      }),
    ).toBe(false);
  });

  it("returns false for unknown field", () => {
    expect(
      isAllowlisted({
        source: "db",
        table: "ticker",
        filter: "all",
        field: "other",
        filters: {},
      }),
    ).toBe(false);
  });
});
