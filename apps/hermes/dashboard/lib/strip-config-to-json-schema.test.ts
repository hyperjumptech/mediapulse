/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { stripConfigToJsonSchema } from "./strip-config-to-json-schema";

describe("stripConfigToJsonSchema", () => {
  const groupedSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      providers: {
        type: "object",
        additionalProperties: false,
        properties: {
          search: {
            type: "object",
            properties: { baseUrl: { type: "string" } },
          },
        },
      },
      collection: {
        type: "object",
        properties: {
          perRunFetchBudget: { type: "number" },
        },
      },
    },
  } as const;

  it("removes legacy flat top-level keys so grouped schema validation can pass", () => {
    const stripped = stripConfigToJsonSchema(groupedSchema, {
      webSearch: { baseUrl: "https://old.example/search" },
      webFetch: { providers: [] },
      collection: { perRunFetchBudget: 20 },
    });

    expect(stripped).toEqual({
      collection: { perRunFetchBudget: 20 },
    });
    expect(stripped).not.toHaveProperty("webSearch");
    expect(stripped).not.toHaveProperty("webFetch");
  });

  it("keeps grouped keys and strips nested unknown fields", () => {
    const stripped = stripConfigToJsonSchema(groupedSchema, {
      providers: {
        search: {
          baseUrl: "https://google.serper.dev/search",
          legacyKey: true,
        },
      },
      collection: { perRunFetchBudget: 40 },
      staleRoot: 1,
    });

    expect(stripped).toEqual({
      providers: {
        search: { baseUrl: "https://google.serper.dev/search" },
      },
      collection: { perRunFetchBudget: 40 },
    });
  });

  it("preserves dynamic record keys when additionalProperties is an object schema", () => {
    const recordSchema = {
      type: "object",
      properties: {},
      additionalProperties: { type: "string" },
    };

    expect(
      stripConfigToJsonSchema(recordSchema, {
        customKey: "value",
        extra: 1,
      }),
    ).toEqual({ customKey: "value" });
  });
});
