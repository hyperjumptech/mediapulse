import { zodToJsonSchema } from "zod-to-json-schema";
import { describe, expect, it } from "vitest";

import {
  contentGenerationConfigDefaults,
  ContentGenerationConfigSchema,
  CONTENT_GENERATION_LLM_PROMPT_FIELD_MAX_LENGTH,
  resolveContentGenerationConfig,
} from "./config-schema.js";

describe("ContentGenerationConfigSchema", () => {
  it("parses minimal config with openai.apiKey and applies all defaults", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      openai: { apiKey: "sk-test" },
    });

    expect(parsed.openai.apiKey).toBe("sk-test");
    expect(parsed.openai.baseUrl).toBeUndefined();
    expect(parsed.openai.model).toBe("gpt-4o-mini");
    expect(parsed.openai.timeoutMs).toBe(120000);
    expect(parsed.output.topNewsCount).toBe(10);
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
    expect(parsed.sourceRanking.enabled).toBe(true);
    expect(parsed.sourceRanking.maxPerHost).toBe(2);
    expect(parsed.sourceRanking.recencyHalfLifeHours).toBe(36);
    expect(parsed.sourceRanking.weights.relevance).toBe(0.45);
    expect(parsed.sourceRanking.weights.recency).toBe(0.25);
    expect(parsed.sourceRanking.weights.tier).toBe(0.2);
    expect(parsed.sourceRanking.weights.length).toBe(0.1);
    expect(parsed.fewShot.enabled).toBe(false);
    expect(parsed.fewShot.maxExemplars).toBe(1);
    expect(parsed.fewShot.sectorTag).toBeUndefined();
    expect(parsed.useBrainstormPass).toBe(false);
    expect(parsed.brainstormMaxOutputTokens).toBe(700);
    expect(parsed.brainstormModel).toBeUndefined();
    expect(parsed.citationGrounding.enabled).toBe(false);
    expect(parsed.citationGrounding.policy).toBe("unlink");
    expect(parsed.citationGrounding.minOverlapScore).toBe(0.18);
    expect(parsed.citationGrounding.numericBonus).toBe(0.2);
    expect(parsed.numericAnchors.enabled).toBe(false);
    expect(parsed.numericAnchors.perArticleCap).toBe(5);
    expect(parsed.numericAnchors.totalCap).toBe(25);
    expect(parsed.numericAnchors.unmatchedPolicy).toBe("warn");
    expect(parsed.crossRunDedup.enabled).toBe(false);
    expect(parsed.crossRunDedup.windowDays).toBe(14);
    expect(parsed.crossRunDedup.minSimilarity).toBe(0.55);
    expect(parsed.crossRunDedup.policy).toBe("warn");
    expect(parsed.crossRunDedup.lowInfoDayThreshold).toBe(0.5);
    expect(parsed.subjectLine.enabled).toBe(false);
    expect(parsed.subjectLine.candidateCount).toBe(5);
    expect(parsed.subjectLine.weights.lengthFit).toBe(0.2);
    expect(parsed.subjectLine.weights.curiosityGap).toBe(0.25);
    expect(parsed.polish.enabled).toBe(false);
    expect(parsed.polish.tier).toBe("safe");
    expect(parsed.polish.disabledRuleIds).toEqual([]);
    expect(parsed.selfCritique.enabled).toBe(false);
    expect(parsed.selfCritique.dropFraction).toBe(0.2);
    expect(parsed.selfCritique.minBulletCount).toBe(8);
    expect(parsed.selfCritique.preferRewriteOverDrop).toBe(true);
  });

  it("resolveContentGenerationConfig defaults brainstormModel to openai.model", () => {
    const resolved = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        openai: { apiKey: "sk-test", model: "gpt-4o" },
        brainstormModel: "gpt-4o-mini",
      }),
    );

    expect(resolved.brainstormModel).toBe("gpt-4o-mini");

    const defaulted = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        openai: { apiKey: "sk-test", model: "gpt-4o" },
      }),
    );
    expect(defaulted.brainstormModel).toBe("gpt-4o");
  });

  it("parses valid full config", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      openai: {
        apiKey: "sk-test-new",
        baseUrl: "https://example.com",
        model: "gpt-4",
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

  it("rejects unknown placeholder in prompts.systemPrompt", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      openai: { apiKey: "sk-test" },
      prompts: {
        systemPrompt: "{{tickerId}} {{notARealToken}}",
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.message.includes("{{notARealToken}}"),
        ),
      ).toBe(true);
    }
  });

  it("rejects unknown placeholder in prompts.userPromptTemplate", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      openai: { apiKey: "sk-test" },
      prompts: {
        userPromptTemplate: "{{tickerId}} {{bogus}}",
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects prompts.systemPrompt longer than max", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      openai: { apiKey: "sk-test" },
      prompts: {
        systemPrompt: "x".repeat(
          CONTENT_GENERATION_LLM_PROMPT_FIELD_MAX_LENGTH + 1,
        ),
      },
    });
    expect(result.success).toBe(false);
  });

  it("accepts systemPrompt at exactly max length", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      openai: { apiKey: "sk-test" },
      prompts: {
        systemPrompt: "y".repeat(
          CONTENT_GENERATION_LLM_PROMPT_FIELD_MAX_LENGTH,
        ),
      },
    });
    expect(parsed.prompts.systemPrompt?.length).toBe(
      CONTENT_GENERATION_LLM_PROMPT_FIELD_MAX_LENGTH,
    );
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

  it("parses config with openai.apiKey only", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      openai: {
        apiKey: "sk-new-style",
      },
    });

    expect(parsed.openai.apiKey).toBe("sk-new-style");
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

  it("parses llmRetry with all fields provided", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      openai: { apiKey: "sk-test" },
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
      openai: { apiKey: "sk-test" },
      llmRetry: { maxAttempts: 5 },
    });

    expect(parsed.llmRetry?.maxAttempts).toBe(5);
    expect(parsed.llmRetry?.baseDelayMs).toBeUndefined();
  });

  it("accepts openai.timeoutMs", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      openai: { apiKey: "sk-test", timeoutMs: 5000 },
    });

    expect(parsed.openai?.timeoutMs).toBe(5000);
  });

  it("rejects non-integer or non-positive timeoutMs", () => {
    expect(() =>
      ContentGenerationConfigSchema.parse({
        openai: { apiKey: "sk-test", timeoutMs: -1 },
      }),
    ).toThrow();
  });
});

describe("resolveContentGenerationConfig", () => {
  it("fills llmRetry defaults when llmRetry is omitted", () => {
    const config = ContentGenerationConfigSchema.parse({
      openai: { apiKey: "sk-test" },
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
      openai: { apiKey: "sk-test" },
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

  it("passes through openai config unchanged", () => {
    const config = ContentGenerationConfigSchema.parse({
      openai: { apiKey: "sk-key", model: "gpt-4o", timeoutMs: 8000 },
    });

    const resolved = resolveContentGenerationConfig(config);

    expect(resolved.openai.apiKey).toBe("sk-key");
    expect(resolved.openai.model).toBe("gpt-4o");
    expect(resolved.openai.timeoutMs).toBe(8000);
  });

  it("fills persistRetry defaults when persistRetry is omitted", () => {
    const config = ContentGenerationConfigSchema.parse({
      openai: { apiKey: "sk-test" },
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
