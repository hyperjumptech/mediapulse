import { describe, expect, it } from "vitest";
import {
  API_KEY_PURPOSE_LABELS,
  API_KEY_PURPOSE_VALUES,
  apiKeyPurposeSchema,
} from "./api-key-purposes";

describe("apiKeyPurposeSchema", () => {
  it("accepts every defined purpose value", () => {
    for (const value of API_KEY_PURPOSE_VALUES) {
      expect(apiKeyPurposeSchema.parse(value)).toBe(value);
    }
  });

  it("rejects unknown purpose strings", () => {
    expect(() => apiKeyPurposeSchema.parse("not-a-purpose")).toThrow();
  });
});

describe("API_KEY_PURPOSE_LABELS", () => {
  it("has a label for each purpose value", () => {
    for (const value of API_KEY_PURPOSE_VALUES) {
      expect(API_KEY_PURPOSE_LABELS[value].length).toBeGreaterThan(0);
    }
  });
});
