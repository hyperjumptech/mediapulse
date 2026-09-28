/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  defaultTitleForFormFieldKey,
  hermesFormJsonSchemaFromZod,
  keepZodV3JsonSchemaShape,
  mergeHermesObjectFormProperties,
} from "./form-json-schema";

describe("defaultTitleForFormFieldKey", () => {
  it("humanizes camelCase", () => {
    // Act
    const t = defaultTitleForFormFieldKey("expansionString");

    // Assert
    expect(t).toBe("Expansion string");
  });
});

describe("hermesFormJsonSchemaFromZod", () => {
  it("returns object type with titled properties", () => {
    // Setup
    const schema = z
      .object({
        name: z.string().min(1),
      })
      .strict();

    // Act
    const json = hermesFormJsonSchemaFromZod(schema);

    // Assert
    expect(json.type).toBe("object");
    const props = json.properties as Record<string, { title?: string }>;
    expect(props.name?.title).toBe("Name");
  });

  it("drops boolean fields from required so checkboxes are optional", () => {
    // Setup
    const schema = z
      .object({
        email: z.string().email(),
        enabled: z.boolean(),
      })
      .strict();

    // Act
    const json = hermesFormJsonSchemaFromZod(schema);

    // Assert
    const required = json.required as string[];
    expect(required).toContain("email");
    expect(required).not.toContain("enabled");
  });
});

describe("mergeHermesObjectFormProperties", () => {
  it("merges property maps", () => {
    // Setup
    const root = {
      type: "object",
      properties: { a: { type: "string" } },
    };

    // Act
    const merged = mergeHermesObjectFormProperties(root, {
      b: { type: "number" },
    });

    // Assert
    const props = merged.properties as Record<string, unknown>;
    expect(props.a).toBeDefined();
    expect(props.b).toEqual({ type: "number" });
  });
});

describe("keepZodV3JsonSchemaShape", () => {
  const toJsonSchema = (schema: z.ZodType) =>
    z.toJSONSchema(schema, {
      target: "draft-7",
      io: "input",
      override: keepZodV3JsonSchemaShape as never,
    }) as Record<string, unknown>;

  it("closes stripping objects with additionalProperties false", () => {
    const json = toJsonSchema(z.object({ name: z.string() }));

    expect(json.additionalProperties).toBe(false);
  });

  it("leaves catch-all objects open", () => {
    const json = toJsonSchema(z.looseObject({ name: z.string() }));

    expect(json.additionalProperties).not.toBe(false);
  });

  it("drops the safe-integer bounds zod 4 adds to integers", () => {
    const json = toJsonSchema(z.number().int());

    expect(json).not.toHaveProperty("maximum");
    expect(json).not.toHaveProperty("minimum");
  });

  it("keeps the default when array items are preprocessed", () => {
    const entry = z.preprocess(
      (value) => value,
      z.object({ provider: z.string() }),
    );

    const json = toJsonSchema(z.array(entry).default([{ provider: "serper" }]));

    expect(json.default).toEqual([{ provider: "serper" }]);
  });

  it("renders discriminated unions as anyOf without format patterns", () => {
    const json = toJsonSchema(
      z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("email"), to: z.email() }),
        z.object({ kind: z.literal("id"), id: z.guid() }),
      ]),
    );
    const text = JSON.stringify(json);

    expect(json).toHaveProperty("anyOf");
    expect(json).not.toHaveProperty("oneOf");
    expect(text).toContain('"format":"email"');
    expect(text).not.toContain('"pattern"');
  });

  it("drops the string propertyNames zod 4 adds to records", () => {
    const json = toJsonSchema(z.record(z.string(), z.string()));

    expect(json).not.toHaveProperty("propertyNames");
  });
});
