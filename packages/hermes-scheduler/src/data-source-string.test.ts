/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  isDataSourceString,
  parseDataSourceString,
} from "./data-source-string";

describe("isDataSourceString", () => {
  it("returns true for valid data source string", () => {
    // Act & Assert
    expect(isDataSourceString("db:ticker:all:id")).toBe(true);
    expect(
      isDataSourceString("db:userTicker:all:tickerId?where.enabled=true"),
    ).toBe(true);
  });

  it("returns false for non-string", () => {
    // Act & Assert
    expect(isDataSourceString(123)).toBe(false);
    expect(isDataSourceString(null)).toBe(false);
    expect(isDataSourceString({})).toBe(false);
  });

  it("returns false for string that does not match format", () => {
    // Act & Assert
    expect(isDataSourceString("ticker:all")).toBe(false);
    expect(isDataSourceString("db:ticker:all")).toBe(false);
  });
});

describe("parseDataSourceString", () => {
  it("parses db:table:selector:field without query", () => {
    // Act
    const r = parseDataSourceString("db:ticker:all:id");

    // Assert
    expect(r).not.toBeNull();
    expect(r?.source).toBe("db");
    expect(r?.table).toBe("ticker");
    expect(r?.selector).toBe("all");
    expect(r?.field).toBe("id");
    expect(r?.where).toEqual({});
  });

  it("parses with where.enabled=true", () => {
    // Act
    const r = parseDataSourceString(
      "db:userTicker:all:tickerId?where.enabled=true&distinct=tickerId",
    );

    // Assert
    expect(r).not.toBeNull();
    expect(r?.where).toEqual({ enabled: "true" });
    expect(r?.distinct).toBe("tickerId");
  });

  it("parses with take and limit", () => {
    // Act
    const r = parseDataSourceString("db:ticker:all:id?take=100&limit=50");

    // Assert
    expect(r).not.toBeNull();
    expect(r?.take).toBe(50);
  });

  it("parses with orderBy", () => {
    // Act
    const r = parseDataSourceString("db:ticker:all:id?orderBy=id:asc");

    // Assert
    expect(r).not.toBeNull();
    expect(r?.orderBy).toEqual({ field: "id", dir: "asc" });
  });

  it("returns null for invalid format", () => {
    // Act & Assert
    expect(parseDataSourceString("invalid")).toBeNull();
    expect(parseDataSourceString("db:ticker:all")).toBeNull();
  });
});
