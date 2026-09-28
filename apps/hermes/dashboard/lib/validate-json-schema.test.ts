import Ajv from "ajv";
import { afterEach, describe, expect, it, vi } from "vitest";

import { validateWithJsonSchema } from "./validate-json-schema";

const VALIDATOR_CACHE_CAPACITY = 256;

const createNamedSchema = (title: string) => ({
  title,
  type: "object",
  properties: { name: { type: "string" } },
  required: ["name"],
});

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

  it("defers format validation for a string holding a variable placeholder", () => {
    // Setup
    const schema = {
      type: "object",
      properties: {
        resend: {
          type: "object",
          properties: {
            from: { type: "string", minLength: 1 },
            replyTo: { type: "string", format: "email" },
          },
        },
      },
    };
    const data = {
      resend: {
        from: "MediaPulse <ceo@mediapulse.hyperjump.tech>",
        replyTo: "{{RESEND_REPLY_TO}}",
      },
    };

    // Act
    const result = validateWithJsonSchema(schema, data);

    // Assert
    expect(result.valid).toBe(true);
  });

  it("defers pattern validation for a string holding a variable placeholder", () => {
    // Setup
    const schema = {
      type: "object",
      properties: {
        region: { type: "string", pattern: "^[a-z]{2}-[a-z]+-[0-9]$" },
      },
    };

    // Act
    const result = validateWithJsonSchema(schema, { region: "{{AWS_REGION}}" });

    // Assert
    expect(result.valid).toBe(true);
  });

  it("still rejects a concrete value that fails the format", () => {
    // Setup
    const schema = {
      type: "object",
      properties: { replyTo: { type: "string", format: "email" } },
    };

    // Act
    const result = validateWithJsonSchema(schema, { replyTo: "not-an-email" });

    // Assert
    expect(result.valid).toBe(false);
  });

  it("still reports non-format errors on an object that also holds a placeholder", () => {
    // Setup
    const schema = {
      type: "object",
      properties: {
        replyTo: { type: "string", format: "email" },
        retries: { type: "number" },
      },
      required: ["replyTo", "retries"],
    };
    const data = { replyTo: "{{RESEND_REPLY_TO}}", retries: "three" };

    // Act
    const result = validateWithJsonSchema(schema, data);

    // Assert
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("/retries"))).toBe(true);
      expect(result.errors.some((e) => e.includes("/replyTo"))).toBe(false);
    }
  });

  describe("compiled validator cache", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("compiles equal schema content once across distinct objects and key orders", () => {
      // Setup
      const compileSpy = vi.spyOn(Ajv.prototype, "compile");
      const firstSchema = createNamedSchema("cache-equal-content");
      const secondSchema = structuredClone(firstSchema);
      const reorderedSchema = {
        required: ["name"],
        properties: { name: { type: "string" } },
        type: "object",
        title: "cache-equal-content",
      };

      // Act
      const firstResult = validateWithJsonSchema(firstSchema, { name: "a" });
      const secondResult = validateWithJsonSchema(secondSchema, {});
      const reorderedResult = validateWithJsonSchema(reorderedSchema, {
        name: "b",
      });

      // Assert
      expect(compileSpy).toHaveBeenCalledTimes(1);
      expect(firstResult).toEqual({ valid: true });
      expect(secondResult).toEqual({
        valid: false,
        errors: ["/ must have required property 'name'"],
      });
      expect(reorderedResult).toEqual({ valid: true });
    });

    it("recompiles when schema content changes", () => {
      // Setup
      const compileSpy = vi.spyOn(Ajv.prototype, "compile");
      const firstSchema = createNamedSchema("cache-changed-content");
      const changedSchema = {
        ...createNamedSchema("cache-changed-content"),
        required: [],
      };

      // Act
      const firstResult = validateWithJsonSchema(firstSchema, {});
      const changedResult = validateWithJsonSchema(changedSchema, {});

      // Assert
      expect(compileSpy).toHaveBeenCalledTimes(2);
      expect(firstResult.valid).toBe(false);
      expect(changedResult).toEqual({ valid: true });
    });

    it("keeps at most 256 validators and removes the least recently used one from Ajv", () => {
      // Setup
      const schemas = Array.from(
        { length: VALIDATOR_CACHE_CAPACITY + 1 },
        (_, schemaIndex) => createNamedSchema(`cache-eviction-${schemaIndex}`),
      );
      const fillingSchemas = schemas.slice(0, VALIDATOR_CACHE_CAPACITY);
      for (const schema of fillingSchemas) {
        validateWithJsonSchema(schema, { name: "fill" });
      }
      const [firstSchema, secondSchema] = schemas;
      const overflowSchema = schemas[VALIDATOR_CACHE_CAPACITY];
      validateWithJsonSchema(firstSchema!, { name: "refresh" });
      const compileSpy = vi.spyOn(Ajv.prototype, "compile");
      const removeSchemaSpy = vi.spyOn(Ajv.prototype, "removeSchema");

      // Act
      validateWithJsonSchema(overflowSchema!, { name: "overflow" });
      validateWithJsonSchema(firstSchema!, { name: "still cached" });
      validateWithJsonSchema(secondSchema!, { name: "evicted" });

      // Assert
      expect(removeSchemaSpy).toHaveBeenNthCalledWith(1, secondSchema);
      expect(compileSpy).toHaveBeenCalledTimes(2);
      expect(compileSpy).toHaveBeenNthCalledWith(1, overflowSchema);
      expect(compileSpy).toHaveBeenNthCalledWith(2, secondSchema);
    });

    it("keeps filtering placeholder-deferred errors on a cached validator", () => {
      // Setup
      const schema = {
        type: "object",
        title: "cache-placeholder",
        properties: { replyTo: { type: "string", format: "email" } },
      };
      const compileSpy = vi.spyOn(Ajv.prototype, "compile");

      // Act
      const firstResult = validateWithJsonSchema(schema, {
        replyTo: "{{RESEND_REPLY_TO}}",
      });
      const secondResult = validateWithJsonSchema(structuredClone(schema), {
        replyTo: "{{RESEND_REPLY_TO}}",
      });
      const concreteResult = validateWithJsonSchema(structuredClone(schema), {
        replyTo: "not-an-email",
      });

      // Assert
      expect(compileSpy).toHaveBeenCalledTimes(1);
      expect(firstResult).toEqual({ valid: true });
      expect(secondResult).toEqual({ valid: true });
      expect(concreteResult).toEqual({
        valid: false,
        errors: ['/replyTo must match format "email"'],
      });
    });

    it("validates repeated schemas that carry the same $id without an already-exists error", () => {
      // Setup
      const schema = {
        $id: "https://hermes.test/schemas/cache-shared-id",
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      };
      const changedSchema = {
        ...structuredClone(schema),
        properties: { name: { type: "string", minLength: 1 } },
      };

      // Act
      const firstResult = validateWithJsonSchema(schema, { name: "a" });
      const secondResult = validateWithJsonSchema(structuredClone(schema), {});
      const changedResult = validateWithJsonSchema(changedSchema, {});

      // Assert
      expect(firstResult).toEqual({ valid: true });
      expect(secondResult).toEqual({
        valid: false,
        errors: ["/ must have required property 'name'"],
      });
      expect(changedResult).toEqual({
        valid: false,
        errors: ["/ must have required property 'name'"],
      });
    });

    it("does not cache a schema that fails to compile and releases it from Ajv", () => {
      // Setup
      const schema = { type: "not-a-type", title: "cache-invalid" };
      const compileSpy = vi.spyOn(Ajv.prototype, "compile");
      const removeSchemaSpy = vi.spyOn(Ajv.prototype, "removeSchema");

      // Act
      const firstResult = validateWithJsonSchema(schema, {});
      const secondResult = validateWithJsonSchema(schema, {});

      // Assert
      expect(firstResult.valid).toBe(false);
      expect(secondResult.valid).toBe(false);
      expect(compileSpy).toHaveBeenCalledTimes(2);
      expect(removeSchemaSpy).toHaveBeenCalledTimes(2);
    });
  });
});
