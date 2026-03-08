import { describe, it, expect } from "vitest";

import { configSchemaFingerprint } from "./config-schema-fingerprint";

describe("configSchemaFingerprint", () => {
  it("returns empty string for null or undefined", () => {
    expect(configSchemaFingerprint(null)).toBe("");
    expect(configSchemaFingerprint(undefined)).toBe("");
  });

  it("returns same string for same schema", () => {
    const schema = { type: "object", properties: { a: { type: "string" } } };
    expect(configSchemaFingerprint(schema)).toBe(
      configSchemaFingerprint(schema),
    );
  });

  it("returns same string for schema with keys in different order", () => {
    const a = { properties: { a: { type: "string" } }, type: "object" };
    const b = { type: "object", properties: { a: { type: "string" } } };
    expect(configSchemaFingerprint(a)).toBe(configSchemaFingerprint(b));
  });

  it("returns different string for different schema", () => {
    const s1 = { type: "object", properties: { a: { type: "string" } } };
    const s2 = { type: "object", properties: { a: { type: "number" } } };
    expect(configSchemaFingerprint(s1)).not.toBe(configSchemaFingerprint(s2));
  });
});
