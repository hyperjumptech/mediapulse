/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  buildDataSourceExpansionReference,
  collectDataSourceExpansionReferenceIds,
  isDataSourceExpansionReference,
  parseDataSourceExpansionReference,
  replaceDataSourceExpansionReferences,
} from "./data-source-expansion-reference";

describe("buildDataSourceExpansionReference", () => {
  it("builds token from id", () => {
    // Act
    const result = buildDataSourceExpansionReference("tpl_123");

    // Assert
    expect(result).toBe("{{dse:tpl_123}}");
  });
});

describe("parseDataSourceExpansionReference", () => {
  it("parses valid token", () => {
    // Act
    const result = parseDataSourceExpansionReference("{{dse:abc-123}}");

    // Assert
    expect(result).toEqual({ id: "abc-123" });
  });

  it("returns null for malformed token", () => {
    // Act
    const badPrefix = parseDataSourceExpansionReference("{{dsa:abc}}");
    const missingEnd = parseDataSourceExpansionReference("{{dse:abc}");
    const missingId = parseDataSourceExpansionReference("{{dse:}}");

    // Assert
    expect(badPrefix).toBeNull();
    expect(missingEnd).toBeNull();
    expect(missingId).toBeNull();
  });
});

describe("isDataSourceExpansionReference", () => {
  it("returns true for valid token and false otherwise", () => {
    // Act
    const valid = isDataSourceExpansionReference("{{dse:abc}}");
    const invalid = isDataSourceExpansionReference("db:ticker:id");
    const notString = isDataSourceExpansionReference({ id: "abc" });

    // Assert
    expect(valid).toBe(true);
    expect(invalid).toBe(false);
    expect(notString).toBe(false);
  });
});

describe("collectDataSourceExpansionReferenceIds", () => {
  it("collects unique ids from top-level object values", () => {
    // Act
    const ids = collectDataSourceExpansionReferenceIds({
      first: "{{dse:one}}",
      second: "{{dse:two}}",
      duplicate: "{{dse:one}}",
      plain: "hello",
      nonString: 42,
    });

    // Assert
    expect(ids.sort()).toEqual(["one", "two"]);
  });
});

describe("replaceDataSourceExpansionReferences", () => {
  it("replaces matched tokens and reports missing ids", () => {
    // Act
    const result = replaceDataSourceExpansionReferences(
      {
        a: "{{dse:one}}",
        b: "{{dse:missing}}",
        c: "plain",
      },
      new Map([["one", "db:ticker:id"]]),
    );

    // Assert
    expect(result.input).toEqual({
      a: "db:ticker:id",
      b: "{{dse:missing}}",
      c: "plain",
    });
    expect(result.missingIds).toEqual(["missing"]);
  });
});
