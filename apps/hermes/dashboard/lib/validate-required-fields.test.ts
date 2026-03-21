import { describe, expect, it } from "vitest";

import { collectEmptyRequiredStringErrors } from "./validate-required-fields";

describe("collectEmptyRequiredStringErrors", () => {
  it("reports empty required string fields", () => {
    // Setup
    const schema = {
      type: "object",
      required: ["tickerId"],
      properties: {
        tickerId: { type: "string" },
      },
    };

    // Act
    const errors = collectEmptyRequiredStringErrors(schema, { tickerId: "" });

    // Assert
    expect(errors).toEqual(["/tickerId is required"]);
  });

  it("reports nested empty required string fields", () => {
    // Setup
    const schema = {
      type: "object",
      required: ["timeWindow"],
      properties: {
        timeWindow: {
          type: "object",
          required: ["start", "end"],
          properties: {
            start: { type: "string" },
            end: { type: "string" },
          },
        },
      },
    };

    // Act
    const errors = collectEmptyRequiredStringErrors(schema, {
      timeWindow: { start: "", end: "" },
    });

    // Assert
    expect(errors).toEqual([
      "/timeWindow/start is required",
      "/timeWindow/end is required",
    ]);
  });

  it("resolves local $ref schemas and reports nested required strings", () => {
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
    const errors = collectEmptyRequiredStringErrors(schema, {
      webFetch: { baseUrl: "" },
    });

    // Assert
    expect(errors).toEqual(["/webFetch/baseUrl is required"]);
  });
});
