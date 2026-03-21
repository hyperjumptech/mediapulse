import { describe, expect, it } from "vitest";

import { ContentGenerationConfigSchema } from "./config-schema.js";

describe("ContentGenerationConfigSchema", () => {
  it("parses required openaiApiKey and omits openaiModel when unset", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      openaiApiKey: "sk-test",
    });
    expect(parsed.openaiApiKey).toBe("sk-test");
    expect(parsed.openaiModel).toBeUndefined();
  });

  it("accepts explicit openaiModel", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      openaiApiKey: "sk-test",
      openaiModel: "gpt-4o",
    });
    expect(parsed.openaiModel).toBe("gpt-4o");
  });

  it("rejects empty openaiApiKey", () => {
    expect(() =>
      ContentGenerationConfigSchema.parse({ openaiApiKey: "" }),
    ).toThrow();
  });

  it("rejects missing openaiApiKey", () => {
    expect(() => ContentGenerationConfigSchema.parse({})).toThrow();
  });
});
