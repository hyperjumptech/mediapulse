import { describe, expect, it } from "vitest";

import { validateWithJsonSchema } from "./validate-json-schema";

describe("validateWithJsonSchema", () => {
  it("fails when required string is empty", () => {
    // Setup
    const schema = {
      type: "object",
      required: ["tickerId"],
      properties: {
        tickerId: { type: "string" },
      },
    };

    // Act
    const result = validateWithJsonSchema(schema, { tickerId: "" });

    // Assert
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(
        result.errors.some((e) => e.includes("/tickerId is required")),
      ).toBe(true);
    }
  });

  it("resolves local $ref and validates nested required string", () => {
    // Setup
    const schema = {
      type: "object",
      required: ["webFetch"],
      properties: {
        webFetch: { $ref: "#/definitions/WebFetchConfig" },
      },
      definitions: {
        WebFetchConfig: {
          type: "object",
          required: ["baseUrl"],
          properties: {
            baseUrl: { type: "string" },
          },
        },
      },
    };

    // Act
    const result = validateWithJsonSchema(schema, {
      webFetch: { baseUrl: "" },
    });

    // Assert
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(
        result.errors.some((e) => e.includes("/webFetch/baseUrl is required")),
      ).toBe(true);
    }
  });

  it("compiles schema with Hermes textarea format on prompt fields", () => {
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
    expect(
      validateWithJsonSchema(schema, {
        prompts: { systemPrompt: "a\nb" },
      }).valid,
    ).toBe(true);
  });

  it("accepts date-time format when ajv-formats is registered", () => {
    const schema = {
      type: "object",
      properties: {
        watermark: { type: "string", format: "date-time" },
      },
      required: ["watermark"],
    };
    expect(
      validateWithJsonSchema(schema, { watermark: "2025-03-13T12:00:00Z" }),
    ).toEqual({ valid: true });
    const invalid = validateWithJsonSchema(schema, { watermark: "not-a-date" });
    expect(invalid.valid).toBe(false);
  });
});
