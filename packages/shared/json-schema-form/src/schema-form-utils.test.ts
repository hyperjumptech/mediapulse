/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";

import {
  applyRequiredDefaults,
  defaultForSchema,
  getSchemaFormType,
} from "./schema-form-utils";
import type { JsonSchema } from "./types";

describe("getSchemaFormType", () => {
  it("returns the type when schema.type is a string", () => {
    expect(getSchemaFormType({ type: "string" })).toBe("string");
  });

  it("returns the first type when schema.type is an array", () => {
    expect(getSchemaFormType({ type: ["string", "null"] })).toBe("string");
  });
});

describe("defaultForSchema", () => {
  it("returns schema.default when set", () => {
    expect(defaultForSchema({ type: "string", default: "x" })).toBe("x");
  });

  it("seeds required object properties recursively", () => {
    const schema: JsonSchema = {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string" },
      },
    };

    expect(defaultForSchema(schema)).toEqual({ name: "" });
  });

  it("returns enum first value for strings with enum", () => {
    expect(defaultForSchema({ type: "string", enum: ["a", "b"] })).toBe("a");
  });

  it("returns type-specific primitives", () => {
    expect(defaultForSchema({ type: "array" })).toEqual([]);
    expect(defaultForSchema({ type: "number" })).toBe(0);
    expect(defaultForSchema({ type: "integer" })).toBe(0);
    expect(defaultForSchema({ type: "boolean" })).toBe(false);
  });
});

describe("applyRequiredDefaults", () => {
  it("returns the same reference when nothing changes", () => {
    const schema: JsonSchema = {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string" },
      },
    };
    const value = { name: "ok" };

    expect(applyRequiredDefaults(schema, value)).toBe(value);
  });

  it("fills missing required keys", () => {
    const schema: JsonSchema = {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string" },
      },
    };

    expect(applyRequiredDefaults(schema, {})).toEqual({ name: "" });
  });

  it("fills nested required object keys", () => {
    const schema: JsonSchema = {
      type: "object",
      required: ["prompts"],
      properties: {
        prompts: {
          type: "object",
          required: ["systemPrompt"],
          properties: {
            systemPrompt: { type: "string" },
          },
        },
      },
    };

    expect(applyRequiredDefaults(schema, { prompts: {} })).toEqual({
      prompts: { systemPrompt: "" },
    });
  });
});
