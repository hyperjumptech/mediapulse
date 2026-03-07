import { describe, expect, it } from "vitest";

import { validateWithJsonSchema } from "./validate-json-schema";

describe("validateWithJsonSchema", () => {
  it("returns valid: true when data satisfies schema", () => {
    // Setup
    const schema = {
      type: "object",
      properties: { tickerId: { type: "string" } },
      required: ["tickerId"],
    };
    const data = { tickerId: "123" };

    // Act
    const result = validateWithJsonSchema(schema, data);

    // Assert
    expect(result.valid).toBe(true);
  });

  it("returns valid: false and errors when data fails schema", () => {
    // Setup
    const schema = {
      type: "object",
      properties: { tickerId: { type: "string" } },
      required: ["tickerId"],
    };
    const data = { tickerId: 123 };

    // Act
    const result = validateWithJsonSchema(schema, data);

    // Assert
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("returns valid: false when required property is missing", () => {
    // Setup
    const schema = {
      type: "object",
      properties: { tickerId: { type: "string" } },
      required: ["tickerId"],
    };
    const data = {};

    // Act
    const result = validateWithJsonSchema(schema, data);

    // Assert
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(
        result.errors.some(
          (e) => e.includes("tickerId") || e.includes("required"),
        ),
      ).toBe(true);
    }
  });
});
