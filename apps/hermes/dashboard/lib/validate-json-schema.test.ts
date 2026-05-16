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

  it("compiles and validates config schema with Hermes textarea format on prompt fields", () => {
    const schema = {
      type: "object",
      properties: {
        prompts: {
          type: "object",
          properties: {
            systemPrompt: { type: "string", format: "textarea" },
          },
        },
      },
    };
    const result = validateWithJsonSchema(schema, {
      prompts: { systemPrompt: "line one\nline two" },
    });
    expect(result.valid).toBe(true);
  });

  it("accepts date-time format when ajv-formats is used", () => {
    const schema = {
      type: "object",
      properties: {
        end: { type: "string", format: "date-time" },
      },
      required: ["end"],
    };
    const validData = { end: "2025-03-13T12:00:00Z" };
    const result = validateWithJsonSchema(schema, validData);
    expect(result.valid).toBe(true);
    const invalidData = { end: "not-a-date" };
    const invalidResult = validateWithJsonSchema(schema, invalidData);
    expect(invalidResult.valid).toBe(false);
  });
});
