import { zodToJsonSchema } from "zod-to-json-schema";
import { describe, expect, it } from "vitest";

import {
  contentGenerationConfigDefaults,
  ContentGenerationConfigSchema,
  resolveContentGenerationConfig,
} from "./config-schema.js";

describe("ContentGenerationConfigSchema", () => {
  it("parses minimal config with legacy openaiApiKey and applies all defaults", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      openaiApiKey: "sk-test",
    });

    expect(parsed.openaiApiKey).toBe("sk-test");
    expect(parsed.openaiBaseUrl).toBeUndefined();
    expect(parsed.openaiModel).toBeUndefined();
    expect(parsed.openai.model).toBe("gpt-4o-mini");
    expect(parsed.openai.temperature).toBe(0.4);
    expect(parsed.openai.timeoutMs).toBe(120000);
    expect(parsed.output.topNewsCount).toBe(3);
    expect(parsed.context.maxCharsPerSource).toBe(8000);
    expect(parsed.context.maxTotalContextChars).toBe(100000);
    expect(parsed.llmRetry.maxAttempts).toBe(3);
    expect(parsed.llmRetry.baseDelayMs).toBe(500);
    expect(parsed.llmRetry.maxDelayMs).toBe(8000);
    expect(parsed.llmRetry.jitter).toBe(true);
    expect(parsed.freshness.strategy).toBe("calendar_day");
    expect(parsed.freshness.timezone).toBe("Asia/Jakarta");
    expect(parsed.persistRetry.maxAttempts).toBe(2);
    expect(parsed.persistRetry.baseDelayMs).toBe(200);
    expect(parsed.persistRetry.maxDelayMs).toBe(2000);
  });

  it("parses valid full config", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      openai: {
        apiKey: "sk-test-new",
        baseUrl: "https://example.com",
        model: "gpt-4",
        temperature: 0.8,
        maxTokens: 1000,
        timeoutMs: 60000,
      },
      prompts: {
        systemPrompt: "You are a bot",
        userPromptTemplate: "Hello {{tickerId}}",
      },
      output: {
        topNewsCount: 5,
      },
      context: {
        maxCharsPerSource: 1000,
        maxTotalContextChars: 10000,
      },
      llmRetry: {
        maxAttempts: 1,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        jitter: false,
      },
      freshness: {
        strategy: "calendar_day",
        timezone: "America/New_York",
      },
      persistRetry: {
        maxAttempts: 1,
        baseDelayMs: 50,
        maxDelayMs: 500,
      },
    });

    expect(parsed.openai.apiKey).toBe("sk-test-new");
    expect(parsed.openai.baseUrl).toBe("https://example.com");
    expect(parsed.openai.model).toBe("gpt-4");
    expect(parsed.output.topNewsCount).toBe(5);
    expect(parsed.prompts.userPromptTemplate).toBe("Hello {{tickerId}}");
    expect(parsed.freshness.timezone).toBe("America/New_York");
  });

  it("accepts legacy explicit openaiModel and new openai.model", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      openaiApiKey: "sk-test",
      openaiModel: "gpt-4o",
      openai: {
        model: "gpt-4-turbo",
      },
    });

    expect(parsed.openaiModel).toBe("gpt-4o");
    expect(parsed.openai.model).toBe("gpt-4-turbo");
  });

  it("rejects empty openaiApiKey if no openai.apiKey provided", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      openaiApiKey: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["openaiApiKey"]);
    }
  });

  it("rejects missing api key", () => {
    const result = ContentGenerationConfigSchema.safeParse({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["openai", "apiKey"]);
    }
  });

  it("parses config with openai.apiKey only (no legacy openaiApiKey)", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      openai: {
        apiKey: "sk-new-style",
      },
    });

    expect(parsed.openai.apiKey).toBe("sk-new-style");
    expect(parsed.openaiApiKey).toBeUndefined();
  });

  it("rejects if both openaiApiKey and openai.apiKey are empty or whitespace", () => {
    // Act & Assert
    const result = ContentGenerationConfigSchema.safeParse({
      openaiApiKey: "   ",
      openai: {
        apiKey: "",
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects topNewsCount of 0", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      openaiApiKey: "sk-test",
      output: { topNewsCount: 0 },
    });

    expect(result.success).toBe(false);
  });

  it("rejects negative topNewsCount", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      openaiApiKey: "sk-test",
      output: { topNewsCount: -1 },
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid freshness timezone", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      openaiApiKey: "sk-test",
      freshness: { timezone: "Not/ATimezone" },
    });

    expect(result.success).toBe(false);
  });

  it("rejects wrong type for topNewsCount", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      openaiApiKey: "sk-test",
      output: { topNewsCount: "three" },
    });

    expect(result.success).toBe(false);
  });

  it("generates correct JSON schema containing all fields", () => {
    const jsonSchema = zodToJsonSchema(ContentGenerationConfigSchema, {
      $refStrategy: "none",
    });

    const schemaStr = JSON.stringify(jsonSchema);
    expect(schemaStr).toContain("openaiApiKey");
    expect(schemaStr).toContain("openaiModel");
    expect(schemaStr).toContain("topNewsCount");
    expect(schemaStr).toContain("systemPrompt");
    expect(schemaStr).toContain("userPromptTemplate");
    expect(schemaStr).toContain("calendar_day");
    expect(schemaStr).toContain("maxCharsPerSource");
    expect(schemaStr).toContain("maxTotalContextChars");
  });

  it("parses llmRetry with all fields provided", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      openaiApiKey: "sk-test",
      llmRetry: {
        maxAttempts: 5,
        baseDelayMs: 200,
        maxDelayMs: 5000,
        jitter: false,
      },
    });

    expect(parsed.llmRetry?.maxAttempts).toBe(5);
    expect(parsed.llmRetry?.baseDelayMs).toBe(200);
    expect(parsed.llmRetry?.maxDelayMs).toBe(5000);
    expect(parsed.llmRetry?.jitter).toBe(false);
  });

  it("accepts partial llmRetry with only maxAttempts set", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      openaiApiKey: "sk-test",
      llmRetry: { maxAttempts: 5 },
    });

    expect(parsed.llmRetry?.maxAttempts).toBe(5);
    expect(parsed.llmRetry?.baseDelayMs).toBeUndefined();
  });

  it("accepts openai.timeoutMs", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      openaiApiKey: "sk-test",
      openai: { timeoutMs: 5000 },
    });

    expect(parsed.openai?.timeoutMs).toBe(5000);
  });

  it("rejects non-integer or non-positive timeoutMs", () => {
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
    const config = ContentGenerationConfigSchema.parse({
      openaiApiKey: "sk-test",
    });

    const resolved = resolveContentGenerationConfig(config);

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
    const config = ContentGenerationConfigSchema.parse({
      openaiApiKey: "sk-test",
      llmRetry: {
        maxAttempts: 5,
        baseDelayMs: 200,
        maxDelayMs: 5000,
        jitter: false,
      },
    });

    const resolved = resolveContentGenerationConfig(config);

    expect(resolved.llmRetry.maxAttempts).toBe(5);
    expect(resolved.llmRetry.baseDelayMs).toBe(200);
    expect(resolved.llmRetry.maxDelayMs).toBe(5000);
    expect(resolved.llmRetry.jitter).toBe(false);
  });

  it("passes through openaiApiKey, openaiModel, openai.timeoutMs unchanged", () => {
    const config = ContentGenerationConfigSchema.parse({
      openaiApiKey: "sk-key",
      openaiModel: "gpt-4o",
      openai: { timeoutMs: 8000 },
    });

    const resolved = resolveContentGenerationConfig(config);

    expect(resolved.openaiApiKey).toBe("sk-key");
    expect(resolved.openaiModel).toBe("gpt-4o");
    expect(resolved.openai?.timeoutMs).toBe(8000);
  });

  it("fills persistRetry defaults when persistRetry is omitted", () => {
    const config = ContentGenerationConfigSchema.parse({
      openaiApiKey: "sk-test",
    });

    const resolved = resolveContentGenerationConfig(config);

    expect(resolved.persistRetry.maxAttempts).toBe(
      contentGenerationConfigDefaults.persistRetry.maxAttempts,
    );
    expect(resolved.persistRetry.baseDelayMs).toBe(
      contentGenerationConfigDefaults.persistRetry.baseDelayMs,
    );
    expect(resolved.persistRetry.maxDelayMs).toBe(
      contentGenerationConfigDefaults.persistRetry.maxDelayMs,
    );
  });
});
