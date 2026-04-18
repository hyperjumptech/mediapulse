import { describe, expect, it } from "vitest";

import {
  contentGenerationConfigDefaults,
  ContentGenerationConfigSchema,
  resolveContentGenerationConfig,
} from "./config-schema.js";

describe("ContentGenerationConfigSchema", () => {
  it("parses required openaiApiKey and omits optional fields when unset", () => {
    // Act
    const parsed = ContentGenerationConfigSchema.parse({
      openaiApiKey: "sk-test",
    });

    // Assert
    expect(parsed.openaiApiKey).toBe("sk-test");
    expect(parsed.openaiBaseUrl).toBeUndefined();
    expect(parsed.openaiModel).toBeUndefined();
    expect(parsed.llmRetry).toBeUndefined();
    expect(parsed.openai).toBeUndefined();
  });

  it("accepts explicit openaiModel", () => {
    // Act
    const parsed = ContentGenerationConfigSchema.parse({
      openaiApiKey: "sk-test",
      openaiModel: "gpt-4o",
    });

    // Assert
    expect(parsed.openaiModel).toBe("gpt-4o");
  });

  it("accepts optional openaiBaseUrl", () => {
    // Act
    const parsed = ContentGenerationConfigSchema.parse({
      openaiApiKey: "sk-test",
      openaiBaseUrl:
        "https://example.openai.azure.com/openai/deployments/my-deployment",
    });

    // Assert
    expect(parsed.openaiBaseUrl).toBe(
      "https://example.openai.azure.com/openai/deployments/my-deployment",
    );
  });

  it("rejects invalid openaiBaseUrl", () => {
    // Act & Assert
    expect(() =>
      ContentGenerationConfigSchema.parse({
        openaiApiKey: "sk-test",
        openaiBaseUrl: "not-a-url",
      }),
    ).toThrow();
  });

  it("rejects empty openaiApiKey", () => {
    // Act & Assert
    expect(() =>
      ContentGenerationConfigSchema.parse({ openaiApiKey: "" }),
    ).toThrow();
  });

  it("rejects missing openaiApiKey", () => {
    // Act & Assert
    expect(() => ContentGenerationConfigSchema.parse({})).toThrow();
  });

  it("parses llmRetry with all fields provided", () => {
    // Act
    const parsed = ContentGenerationConfigSchema.parse({
      openaiApiKey: "sk-test",
      llmRetry: {
        maxAttempts: 5,
        baseDelayMs: 200,
        maxDelayMs: 5000,
        jitter: false,
      },
    });

    // Assert
    expect(parsed.llmRetry?.maxAttempts).toBe(5);
    expect(parsed.llmRetry?.baseDelayMs).toBe(200);
    expect(parsed.llmRetry?.maxDelayMs).toBe(5000);
    expect(parsed.llmRetry?.jitter).toBe(false);
  });

  it("accepts partial llmRetry with only maxAttempts set", () => {
    // Act
    const parsed = ContentGenerationConfigSchema.parse({
      openaiApiKey: "sk-test",
      llmRetry: { maxAttempts: 5 },
    });

    // Assert
    expect(parsed.llmRetry?.maxAttempts).toBe(5);
    // Other fields are undefined until resolved
    expect(parsed.llmRetry?.baseDelayMs).toBeUndefined();
  });

  it("accepts openai.timeoutMs", () => {
    // Act
    const parsed = ContentGenerationConfigSchema.parse({
      openaiApiKey: "sk-test",
      openai: { timeoutMs: 5000 },
    });

    // Assert
    expect(parsed.openai?.timeoutMs).toBe(5000);
  });

  it("rejects non-integer or non-positive timeoutMs", () => {
    // Act & Assert
    expect(() =>
      ContentGenerationConfigSchema.parse({
        openaiApiKey: "sk-test",
        openai: { timeoutMs: -1 },
      }),
    ).toThrow();
  });
});

describe("resolveContentGenerationConfig", () => {
  it("fills llmRetry defaults when llmRetry is omitted", () => {
    // Setup
    const config = ContentGenerationConfigSchema.parse({
      openaiApiKey: "sk-test",
    });

    // Act
    const resolved = resolveContentGenerationConfig(config);

    // Assert
    expect(resolved.llmRetry.maxAttempts).toBe(
      contentGenerationConfigDefaults.llmRetry.maxAttempts,
    );
    expect(resolved.llmRetry.baseDelayMs).toBe(
      contentGenerationConfigDefaults.llmRetry.baseDelayMs,
    );
    expect(resolved.llmRetry.maxDelayMs).toBe(
      contentGenerationConfigDefaults.llmRetry.maxDelayMs,
    );
    expect(resolved.llmRetry.jitter).toBe(
      contentGenerationConfigDefaults.llmRetry.jitter,
    );
  });

  it("preserves explicit llmRetry values when supplied", () => {
    // Setup
    const config = ContentGenerationConfigSchema.parse({
      openaiApiKey: "sk-test",
      llmRetry: {
        maxAttempts: 5,
        baseDelayMs: 200,
        maxDelayMs: 5000,
        jitter: false,
      },
    });

    // Act
    const resolved = resolveContentGenerationConfig(config);

    // Assert
    expect(resolved.llmRetry.maxAttempts).toBe(5);
    expect(resolved.llmRetry.baseDelayMs).toBe(200);
    expect(resolved.llmRetry.maxDelayMs).toBe(5000);
    expect(resolved.llmRetry.jitter).toBe(false);
  });

  it("passes through openaiApiKey, openaiModel, openai.timeoutMs unchanged", () => {
    // Setup
    const config = ContentGenerationConfigSchema.parse({
      openaiApiKey: "sk-key",
      openaiModel: "gpt-4o",
      openai: { timeoutMs: 8000 },
    });

    // Act
    const resolved = resolveContentGenerationConfig(config);

    // Assert
    expect(resolved.openaiApiKey).toBe("sk-key");
    expect(resolved.openaiModel).toBe("gpt-4o");
    expect(resolved.openai?.timeoutMs).toBe(8000);
  });
});
