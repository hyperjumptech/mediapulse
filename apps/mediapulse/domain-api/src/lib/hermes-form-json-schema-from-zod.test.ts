/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  defaultTitleForFormFieldKey,
  hermesFormJsonSchemaFromZod,
  mergeHermesObjectFormProperties,
} from "./hermes-form-json-schema-from-zod";

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
