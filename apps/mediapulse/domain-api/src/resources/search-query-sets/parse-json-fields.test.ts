/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { parseJsonArrayField, parseJsonObjectField } from "./parse-json-fields";

describe("parseJsonObjectField", () => {
  it("parses a JSON string object", () => {
    // Act
    const result = parseJsonObjectField('{"a":1}', "strategySnapshot");

    // Assert
    expect(result).toEqual({ ok: true, value: { a: 1 } });
  });

  it("rejects invalid JSON", () => {
    // Act
    const result = parseJsonObjectField("{", "strategySnapshot");

    // Assert
    expect(result.ok).toBe(false);
  });
});

describe("parseJsonArrayField", () => {
  it("parses a JSON string array", () => {
    // Act
    const result = parseJsonArrayField('[{"text":"x"}]', "queries");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
    }
  });
});
