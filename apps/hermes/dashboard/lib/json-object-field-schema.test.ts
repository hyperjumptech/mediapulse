import { describe, expect, it } from "vitest";

import {
  jsonObjectFieldSchema,
  optionalJsonObjectFieldSchema,
} from "@/lib/json-object-field-schema";

describe("jsonObjectFieldSchema", () => {
  it("accepts an object as is", () => {
    const schema = jsonObjectFieldSchema("Endpoint");

    const parsed = schema.parse({ url: "https://agent.example.com" });

    expect(parsed).toEqual({ url: "https://agent.example.com" });
  });

  it("parses a JSON object string", () => {
    const schema = jsonObjectFieldSchema("Endpoint");

    const parsed = schema.parse('{"url":"https://agent.example.com"}');

    expect(parsed).toEqual({ url: "https://agent.example.com" });
  });

  it("reports invalid JSON as a validation issue", () => {
    const schema = jsonObjectFieldSchema("Endpoint");

    const result = schema.safeParse("{not json");

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "Invalid JSON in Endpoint",
    );
  });

  it("rejects a JSON array", () => {
    const schema = jsonObjectFieldSchema("Endpoint");

    const result = schema.safeParse("[1,2]");

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "Endpoint must be a JSON object",
    );
  });

  it("requires a value", () => {
    const schema = jsonObjectFieldSchema("Endpoint");

    const result = schema.safeParse(undefined);

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "Endpoint is required",
    );
  });

  it("rejects a non-object value", () => {
    const schema = jsonObjectFieldSchema("Endpoint");

    const result = schema.safeParse(42);

    expect(result.success).toBe(false);
  });
});

describe("optionalJsonObjectFieldSchema", () => {
  it("treats a missing or empty value as undefined", () => {
    const schema = optionalJsonObjectFieldSchema("Endpoint");

    const missing = schema.parse(undefined);
    const empty = schema.parse("");

    expect(missing).toBeUndefined();
    expect(empty).toBeUndefined();
  });

  it("accepts an object or a JSON object string", () => {
    const schema = optionalJsonObjectFieldSchema("Endpoint");

    const fromObject = schema.parse({ method: "POST" });
    const fromString = schema.parse('{"method":"POST"}');

    expect(fromObject).toEqual({ method: "POST" });
    expect(fromString).toEqual({ method: "POST" });
  });
});
