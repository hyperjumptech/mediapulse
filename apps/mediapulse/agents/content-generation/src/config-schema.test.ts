import { zodToJsonSchema } from "zod-to-json-schema";
import { describe, expect, it } from "vitest";

import { ContentGenerationConfigSchema } from "./config-schema.js";

describe("ContentGenerationConfigSchema", () => {
  it("parses minimal config with openai.apiKey and applies all defaults", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      openai: { apiKey: "sk-test" },
    });

    expect(parsed.openai.apiKey).toBe("sk-test");
    expect(parsed.openai.baseUrl).toBeUndefined();
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

  it("rejects missing openai object", () => {
    const result = ContentGenerationConfigSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "openai")).toBe(
        true,
      );
    }
  });

  it("rejects missing openai.apiKey", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      openai: {},
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (i) => i.path[0] === "openai" && i.path[1] === "apiKey",
        ),
      ).toBe(true);
    }
  });

  it("rejects empty openai.apiKey", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      openai: { apiKey: "" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only openai.apiKey", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      openai: { apiKey: "   " },
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown top-level legacy openaiApiKey", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      openaiApiKey: "sk-test",
      openai: { apiKey: "sk-test" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects topNewsCount of 0", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      openai: { apiKey: "sk-test" },
      output: { topNewsCount: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative topNewsCount", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      openai: { apiKey: "sk-test" },
      output: { topNewsCount: -1 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid freshness timezone", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      openai: { apiKey: "sk-test" },
      freshness: { timezone: "Not/ATimezone" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects wrong type for topNewsCount", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      openai: { apiKey: "sk-test" },
      output: { topNewsCount: "three" },
    });
    expect(result.success).toBe(false);
  });

  it("JSON schema exposes nested openai only (no top-level openaiApiKey)", () => {
    const jsonSchema = zodToJsonSchema(ContentGenerationConfigSchema, {
      $refStrategy: "none",
    });

    const schemaStr = JSON.stringify(jsonSchema);
    expect(schemaStr).toContain('"openai"');
    expect(schemaStr).toContain("apiKey");
    expect(schemaStr).not.toContain("openaiApiKey");
    expect(schemaStr).not.toContain("openaiModel");
    expect(schemaStr).toContain("topNewsCount");
    expect(schemaStr).toContain("systemPrompt");
    expect(schemaStr).toContain("userPromptTemplate");
    expect(schemaStr).toContain("calendar_day");
    expect(schemaStr).toContain("maxCharsPerSource");
    expect(schemaStr).toContain("maxTotalContextChars");
  });
});
