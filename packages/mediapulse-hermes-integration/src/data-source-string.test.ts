/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  isDataSourceString,
  parseDataSourceString,
} from "./data-source-string";

describe("isDataSourceString", () => {
  it("returns true for valid data source string", () => {
    // Act & Assert
    expect(isDataSourceString("db:ticker:id")).toBe(true);
    expect(
      isDataSourceString("db:userTicker:tickerId?where.enabled=true"),
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
    expect(isDataSourceString("ticker:id")).toBe(false);
    expect(isDataSourceString("db:ticker")).toBe(false);
  });
});

describe("parseDataSourceString", () => {
  it("parses db:table:field without query", () => {
    // Act
    const result = parseDataSourceString("db:ticker:id");

    // Assert
    expect(result).not.toBeNull();
    expect(result?.source).toBe("db");
    expect(result?.table).toBe("ticker");
    expect(result?.field).toBe("id");
    expect(result?.where).toEqual({});
  });

  it("parses with where.enabled=true", () => {
    // Act
    const result = parseDataSourceString(
      "db:userTicker:tickerId?where.enabled=true&distinct=tickerId",
    );

    // Assert
    expect(result).not.toBeNull();
    expect(result?.where).toEqual({ enabled: "true" });
    expect(result?.distinct).toBe("tickerId");
  });

  it("parses with take and limit", () => {
    // Act
    const result = parseDataSourceString("db:ticker:id?take=100&limit=50");

    // Assert
    expect(result).not.toBeNull();
    expect(result?.take).toBe(50);
  });

  it("parses with orderBy", () => {
    // Act
    const result = parseDataSourceString("db:ticker:id?orderBy=id:asc");

    // Assert
    expect(result).not.toBeNull();
    expect(result?.orderBy).toEqual({ field: "id", dir: "asc" });
  });

  it("returns null for invalid format", () => {
    // Act & Assert
    expect(parseDataSourceString("invalid")).toBeNull();
    expect(parseDataSourceString("db:ticker")).toBeNull();
  });
});
