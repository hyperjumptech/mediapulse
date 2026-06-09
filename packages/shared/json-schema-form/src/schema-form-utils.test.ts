/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";

import {
  applySchemaDefaults,
  collectSchemaDefaults,
  defaultForSchema,
  getSchemaFormType,
  seedNewArrayItem,
} from "./schema-form-utils";
import type { JsonSchema } from "./types";

describe("getSchemaFormType", () => {
  it("returns the type when schema.type is a string", () => {
    expect(getSchemaFormType({ type: "string" })).toBe("string");
  });

  it("returns the first type when schema.type is an array", () => {
    expect(getSchemaFormType({ type: ["string", "boolean"] })).toBe("string");
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

describe("collectSchemaDefaults", () => {
  it("returns undefined when no default is declared", () => {
    expect(collectSchemaDefaults({ type: "string" })).toBeUndefined();
  });

  it("returns a primitive default when declared", () => {
    expect(collectSchemaDefaults({ type: "string", default: "x" })).toBe("x");
  });

  it("collects optional property defaults on an object", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        enabled: { type: "boolean", default: true },
        label: { type: "string", default: "hello" },
      },
    };

    expect(collectSchemaDefaults(schema)).toEqual({
      enabled: true,
      label: "hello",
    });
  });

  it("expands a default {} group with nested field defaults", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        grp: {
          type: "object",
          default: {},
          properties: {
            b: { type: "string", default: "x" },
          },
        },
      },
    };

    expect(collectSchemaDefaults(schema)).toEqual({ grp: { b: "x" } });
  });

  it("does not fabricate defaults for optional defaultless fields", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        withDefault: { type: "string", default: "x" },
        withoutDefault: { type: "string" },
      },
    };

    expect(collectSchemaDefaults(schema)).toEqual({ withDefault: "x" });
  });
});

describe("seedNewArrayItem", () => {
  it("returns enum[0] for a string with enum", () => {
    expect(seedNewArrayItem({ type: "string", enum: ["rss", "sitemap"] })).toBe(
      "rss",
    );
  });

  it("returns empty string for a plain string", () => {
    expect(seedNewArrayItem({ type: "string" })).toBe("");
  });

  it("returns type-zero for number and boolean", () => {
    expect(seedNewArrayItem({ type: "number" })).toBe(0);
    expect(seedNewArrayItem({ type: "boolean" })).toBe(false);
  });

  it("uses schema.default when present on a primitive", () => {
    expect(
      seedNewArrayItem({
        type: "string",
        default: "sitemap",
        enum: ["rss", "sitemap"],
      }),
    ).toBe("sitemap");
  });

  it("seeds an object with required type-zero values merged with declared defaults", () => {
    const schema: JsonSchema = {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string" },
        enabled: { type: "boolean", default: true },
      },
    };

    expect(seedNewArrayItem(schema)).toEqual({ name: "", enabled: true });
  });

  it("declared defaults override required type-zero seeds for the same key", () => {
    const schema: JsonSchema = {
      type: "object",
      required: ["strategy"],
      properties: {
        strategy: { type: "string", enum: ["rss", "sitemap"], default: "rss" },
      },
    };

    expect(seedNewArrayItem(schema)).toEqual({ strategy: "rss" });
  });
});

describe("applySchemaDefaults", () => {
  it("returns the same reference when nothing changes", () => {
    const schema: JsonSchema = {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string" },
      },
    };
    const value = { name: "ok" };

    expect(applySchemaDefaults(schema, value)).toBe(value);
  });

  it("fills missing required keys with type-zero defaults", () => {
    const schema: JsonSchema = {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string" },
      },
    };

    expect(applySchemaDefaults(schema, {})).toEqual({ name: "" });
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

    expect(applySchemaDefaults(schema, { prompts: {} })).toEqual({
      prompts: { systemPrompt: "" },
    });
  });

  it("seeds optional fields with declared defaults from an empty object", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        enabled: { type: "boolean", default: true },
        label: { type: "string", default: "{{NAME}}" },
      },
    };

    expect(applySchemaDefaults(schema, {})).toEqual({
      enabled: true,
      label: "{{NAME}}",
    });
  });

  it("seeds a default {} group with nested field defaults from an empty object", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        grp: {
          type: "object",
          default: {},
          properties: {
            b: { type: "string", default: "x" },
            enabled: { type: "boolean", default: true },
          },
        },
      },
    };

    expect(applySchemaDefaults(schema, {})).toEqual({
      grp: { b: "x", enabled: true },
    });
  });

  it("does not fabricate optional defaultless fields", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        withDefault: { type: "string", default: "x" },
        withoutDefault: { type: "string" },
      },
    };

    expect(applySchemaDefaults(schema, {})).toEqual({ withDefault: "x" });
  });

  it("seeds when top-level required is empty", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        flag: { type: "boolean", default: false },
      },
    };

    expect(applySchemaDefaults(schema, {})).toEqual({ flag: false });
  });

  it("is idempotent once defaults are applied", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        enabled: { type: "boolean", default: true },
      },
    };
    const seeded = applySchemaDefaults(schema, {});

    expect(applySchemaDefaults(schema, seeded)).toBe(seeded);
  });
});
