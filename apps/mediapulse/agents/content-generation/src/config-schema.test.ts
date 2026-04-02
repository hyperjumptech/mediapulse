import { describe, expect, it } from "vitest";

import { ContentGenerationConfigSchema } from "./config-schema.js";

describe("ContentGenerationConfigSchema", () => {
  it("parses required openaiApiKey and omits optional fields when unset", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      openaiApiKey: "sk-test",
    });
    expect(parsed.openaiApiKey).toBe("sk-test");
    expect(parsed.openaiBaseUrl).toBeUndefined();
    expect(parsed.openaiModel).toBeUndefined();
  });

  it("accepts explicit openaiModel", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      openaiApiKey: "sk-test",
      openaiModel: "gpt-4o",
    });
    expect(parsed.openaiModel).toBe("gpt-4o");
  });

  it("accepts optional openaiBaseUrl", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      openaiApiKey: "sk-test",
      openaiBaseUrl:
        "https://example.openai.azure.com/openai/deployments/my-deployment",
    });
    expect(parsed.openaiBaseUrl).toBe(
      "https://example.openai.azure.com/openai/deployments/my-deployment",
    );
  });

  it("rejects invalid openaiBaseUrl", () => {
    expect(() =>
      ContentGenerationConfigSchema.parse({
        openaiApiKey: "sk-test",
        openaiBaseUrl: "not-a-url",
      }),
    ).toThrow();
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
