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
});
