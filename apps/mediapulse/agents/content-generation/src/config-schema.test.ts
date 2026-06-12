import { zodToJsonSchema } from "zod-to-json-schema";
import { describe, expect, it } from "vitest";

import {
  ContentGenerationConfigSchema,
  CONTENT_GENERATION_RETRY_MAX_ATTEMPTS_CEILING,
  resolveContentGenerationConfig,
} from "./config-schema.js";

const testCredentials = {
  credentials: { openaiApiKey: "sk-test" },
} as const;

describe("ContentGenerationConfigSchema", () => {
  it("parses empty {} into the full grouped recommended config", () => {
    const parsed = ContentGenerationConfigSchema.parse({});

    expect(parsed.credentials.openaiApiKey).toBe("{{OPENAI_API_KEY}}");
    expect(parsed.credentials.baseUrl).toBeUndefined();
    expect(parsed.credentials.chatModel).toBe("{{OPENAI_MODEL}}");
    expect(parsed.credentials.timeoutMs).toBe(120_000);
    expect(parsed.output.topNewsCount).toBe(10);
    expect(parsed.inputs.context.maxCharsPerSource).toBe(8000);
    expect(parsed.inputs.context.maxTotalContextChars).toBe(100_000);
    expect(parsed.reliability.llmRetry.maxAttempts).toBe(3);
    expect(parsed.reliability.llmRetry.baseDelayMs).toBe(500);
    expect(parsed.reliability.llmRetry.maxDelayMs).toBe(8000);
    expect(parsed.reliability.llmRetry.jitter).toBe(true);
    expect(parsed.freshness.strategy).toBe("calendar_day");
    expect(parsed.freshness.timezone).toBe("Asia/Jakarta");
    expect(parsed.reliability.persistRetry.maxAttempts).toBe(2);
    expect(parsed.reliability.persistRetry.baseDelayMs).toBe(200);
    expect(parsed.reliability.persistRetry.maxDelayMs).toBe(2000);
    expect(parsed.inputs.sourceRanking.enabled).toBe(true);
    expect(parsed.inputs.sourceRanking.maxPerHost).toBe(2);
    expect(parsed.inputs.sourceRanking.recencyHalfLifeHours).toBe(36);
    expect(parsed.inputs.sourceRanking.weights.relevance).toBe(0.45);
    expect(parsed.inputs.sourceRanking.weights.recency).toBe(0.25);
    expect(parsed.inputs.sourceRanking.weights.tier).toBe(0.2);
    expect(parsed.inputs.sourceRanking.weights.length).toBe(0.1);
    expect(parsed.inputs.fewShot.enabled).toBe(true);
    expect(parsed.inputs.fewShot.maxExemplars).toBe(1);
    expect(parsed.inputs.fewShot.sectorTag).toBeUndefined();
    expect(parsed.creativity.brainstorm.enabled).toBe(true);
    expect(parsed.creativity.brainstorm.model).toBeUndefined();
    expect(parsed.quality.citationGrounding.enabled).toBe(true);
    expect(parsed.quality.citationGrounding.policy).toBe("unlink");
    expect(parsed.quality.citationGrounding.minOverlapScore).toBe(0.18);
    expect(parsed.quality.citationGrounding.numericBonus).toBe(0.2);
    expect(parsed.inputs.numericAnchors.enabled).toBe(true);
    expect(parsed.inputs.numericAnchors.perArticleCap).toBe(5);
    expect(parsed.inputs.numericAnchors.totalCap).toBe(25);
    expect(parsed.inputs.numericAnchors.unmatchedPolicy).toBe("warn");
    expect(parsed.quality.crossRunDedup.enabled).toBe(true);
    expect(parsed.quality.crossRunDedup.windowDays).toBe(14);
    expect(parsed.quality.crossRunDedup.minSimilarity).toBe(0.55);
    expect(parsed.quality.crossRunDedup.policy).toBe("warn");
    expect(parsed.quality.crossRunDedup.lowInfoDayThreshold).toBe(0.5);
    expect(parsed.delivery.subjectLine.enabled).toBe(true);
    expect(parsed.delivery.subjectLine.candidateCount).toBe(5);
    expect(parsed.delivery.subjectLine.weights.lengthFit).toBe(0.2);
    expect(parsed.delivery.subjectLine.weights.curiosityGap).toBe(0.25);
    expect(parsed.quality.polish.enabled).toBe(true);
    expect(parsed.quality.polish.tier).toBe("safe");
    expect(parsed.quality.polish.disabledRuleIds).toEqual([]);
    expect(parsed.quality.selfCritique.enabled).toBe(true);
    expect(parsed.quality.selfCritique.dropFraction).toBe(0.2);
    expect(parsed.quality.selfCritique.minBulletCount).toBe(8);
    expect(parsed.quality.selfCritique.preferRewriteOverDrop).toBe(true);
  });

  it("resolveContentGenerationConfig defaults brainstormModel to credentials.chatModel", () => {
    const resolved = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        credentials: { openaiApiKey: "sk-test", chatModel: "gpt-4o" },
        creativity: { brainstorm: { model: "gpt-4o-mini" } },
      }),
    );

    expect(resolved.brainstormModel).toBe("gpt-4o-mini");

    const defaulted = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        credentials: { openaiApiKey: "sk-test", chatModel: "gpt-4o" },
      }),
    );
    expect(defaulted.brainstormModel).toBe("gpt-4o");
  });

  it("parses valid full grouped config", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      credentials: {
        openaiApiKey: "sk-test-new",
        baseUrl: "https://example.com",
        chatModel: "gpt-4",
        maxTokens: 1000,
        timeoutMs: 60_000,
      },
      output: {
        topNewsCount: 5,
      },
      inputs: {
        context: {
          maxCharsPerSource: 1000,
          maxTotalContextChars: 10_000,
        },
      },
      reliability: {
        llmRetry: {
          maxAttempts: 1,
          baseDelayMs: 100,
          maxDelayMs: 1000,
          jitter: false,
        },
        persistRetry: {
          maxAttempts: 1,
          baseDelayMs: 50,
          maxDelayMs: 500,
        },
      },
      freshness: {
        strategy: "calendar_day",
        timezone: "America/New_York",
      },
    });

    expect(parsed.credentials.openaiApiKey).toBe("sk-test-new");
    expect(parsed.credentials.baseUrl).toBe("https://example.com");
    expect(parsed.credentials.chatModel).toBe("gpt-4");
    expect(parsed.output.topNewsCount).toBe(5);
    expect(parsed.freshness.timezone).toBe("America/New_York");
  });

  it("parses config with credentials.openaiApiKey only", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      credentials: {
        openaiApiKey: "sk-new-style",
      },
    });

    expect(parsed.credentials.openaiApiKey).toBe("sk-new-style");
  });

  it("rejects empty credentials.openaiApiKey", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      credentials: { openaiApiKey: "" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only credentials.openaiApiKey", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      credentials: { openaiApiKey: "   " },
    });
    expect(result.success).toBe(false);
  });

  it("rejects legacy flat top-level keys", () => {
    for (const legacyKey of [
      "openai",
      "sourceRanking",
      "fewShot",
      "useBrainstormPass",
      "brainstormModel",
      "crossRunDedup",
      "subjectLine",
      "polish",
      "selfCritique",
      "llmRetry",
      "persistRetry",
      "context",
      "numericAnchors",
      "citationGrounding",
      "sampling",
    ] as const) {
      const result = ContentGenerationConfigSchema.safeParse({
        ...testCredentials,
        [legacyKey]: {},
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects topNewsCount of 0", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      ...testCredentials,
      output: { topNewsCount: 0 },
    });

    expect(result.success).toBe(false);
  });

  it("rejects negative topNewsCount", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      ...testCredentials,
      output: { topNewsCount: -1 },
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid freshness timezone", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      ...testCredentials,
      freshness: { timezone: "Not/ATimezone" },
    });

    expect(result.success).toBe(false);
  });

  it("rejects wrong type for topNewsCount", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      ...testCredentials,
      output: { topNewsCount: "three" },
    });

    expect(result.success).toBe(false);
  });

  it("JSON schema exposes grouped config sections", () => {
    const jsonSchema = zodToJsonSchema(ContentGenerationConfigSchema, {
      $refStrategy: "none",
    });

    const schemaStr = JSON.stringify(jsonSchema);
    expect(schemaStr).toContain('"credentials"');
    expect(schemaStr).toContain("openaiApiKey");
    expect(schemaStr).toContain("chatModel");
    expect(schemaStr).toContain("inputs");
    expect(schemaStr).toContain("creativity");
    expect(schemaStr).toContain("quality");
    expect(schemaStr).toContain("delivery");
    expect(schemaStr).toContain("reliability");
    expect(schemaStr).toContain("topNewsCount");
    expect(schemaStr).toContain("calendar_day");
    expect(schemaStr).toContain("maxCharsPerSource");
    expect(schemaStr).toContain("maxTotalContextChars");
    expect(schemaStr).not.toContain('"openai"');
  });

  it("parses reliability.llmRetry with all fields provided", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      ...testCredentials,
      reliability: {
        llmRetry: {
          maxAttempts: 5,
          baseDelayMs: 200,
          maxDelayMs: 5000,
          jitter: false,
        },
      },
    });

    expect(parsed.reliability.llmRetry.maxAttempts).toBe(5);
    expect(parsed.reliability.llmRetry.baseDelayMs).toBe(200);
    expect(parsed.reliability.llmRetry.maxDelayMs).toBe(5000);
    expect(parsed.reliability.llmRetry.jitter).toBe(false);
  });

  it("accepts partial reliability.llmRetry with only maxAttempts set", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      ...testCredentials,
      reliability: {
        llmRetry: { maxAttempts: 5 },
      },
    });

    expect(parsed.reliability.llmRetry.maxAttempts).toBe(5);
    expect(parsed.reliability.llmRetry.baseDelayMs).toBe(500);
  });

  it("accepts credentials.timeoutMs", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      credentials: { openaiApiKey: "sk-test", timeoutMs: 5000 },
    });

    expect(parsed.credentials.timeoutMs).toBe(5000);
  });

  it("rejects non-integer or non-positive timeoutMs", () => {
    expect(() =>
      ContentGenerationConfigSchema.parse({
        credentials: { openaiApiKey: "sk-test", timeoutMs: -1 },
      }),
    ).toThrow();
  });

  it("rejects llmRetry when maxDelayMs is below baseDelayMs", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      ...testCredentials,
      reliability: {
        llmRetry: { baseDelayMs: 250, maxDelayMs: 4 },
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.path[0] === "reliability" &&
            issue.path[1] === "llmRetry" &&
            issue.path[2] === "maxDelayMs",
        ),
      ).toBe(true);
    }
  });

  it("rejects persistRetry when maxDelayMs is below baseDelayMs", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      ...testCredentials,
      reliability: {
        persistRetry: { baseDelayMs: 500, maxDelayMs: 100 },
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.path[0] === "reliability" &&
            issue.path[1] === "persistRetry" &&
            issue.path[2] === "maxDelayMs",
        ),
      ).toBe(true);
    }
  });

  it("rejects llmRetry maxAttempts above the ceiling", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      ...testCredentials,
      reliability: {
        llmRetry: {
          maxAttempts: CONTENT_GENERATION_RETRY_MAX_ATTEMPTS_CEILING + 1,
        },
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.path[0] === "reliability" &&
            issue.path[1] === "llmRetry" &&
            issue.path[2] === "maxAttempts",
        ),
      ).toBe(true);
    }
  });

  it("rejects persistRetry maxAttempts above the ceiling", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      ...testCredentials,
      reliability: {
        persistRetry: {
          maxAttempts: CONTENT_GENERATION_RETRY_MAX_ATTEMPTS_CEILING + 1,
        },
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.path[0] === "reliability" &&
            issue.path[1] === "persistRetry" &&
            issue.path[2] === "maxAttempts",
        ),
      ).toBe(true);
    }
  });

  it("accepts default and valid explicit retry overrides", () => {
    const defaulted = ContentGenerationConfigSchema.parse({});
    expect(defaulted.reliability.llmRetry.maxAttempts).toBe(3);
    expect(defaulted.reliability.llmRetry.maxDelayMs).toBe(8000);

    const explicit = ContentGenerationConfigSchema.parse({
      ...testCredentials,
      reliability: {
        llmRetry: {
          maxAttempts: 3,
          baseDelayMs: 250,
          maxDelayMs: 8000,
          jitter: true,
        },
        persistRetry: {
          maxAttempts: 2,
          baseDelayMs: 200,
          maxDelayMs: 2000,
        },
      },
    });
    expect(explicit.reliability.llmRetry.maxAttempts).toBe(3);
    expect(explicit.reliability.persistRetry.maxAttempts).toBe(2);
  });
});

describe("resolveContentGenerationConfig", () => {
  it("preserves explicit reliability.llmRetry values when supplied", () => {
    const config = ContentGenerationConfigSchema.parse({
      ...testCredentials,
      reliability: {
        llmRetry: {
          maxAttempts: 5,
          baseDelayMs: 200,
          maxDelayMs: 5000,
          jitter: false,
        },
      },
    });

    const resolved = resolveContentGenerationConfig(config);

    expect(resolved.reliability.llmRetry.maxAttempts).toBe(5);
    expect(resolved.reliability.llmRetry.baseDelayMs).toBe(200);
    expect(resolved.reliability.llmRetry.maxDelayMs).toBe(5000);
    expect(resolved.reliability.llmRetry.jitter).toBe(false);
  });

  it("passes through credentials config unchanged", () => {
    const config = ContentGenerationConfigSchema.parse({
      credentials: {
        openaiApiKey: "sk-key",
        chatModel: "gpt-4o",
        timeoutMs: 8000,
      },
    });

    const resolved = resolveContentGenerationConfig(config);

    expect(resolved.credentials.openaiApiKey).toBe("sk-key");
    expect(resolved.credentials.chatModel).toBe("gpt-4o");
    expect(resolved.credentials.timeoutMs).toBe(8000);
  });

  it("resolves critiqueModel and subjectLineModel from chatModel when omitted", () => {
    const resolved = resolveContentGenerationConfig(
      ContentGenerationConfigSchema.parse({
        credentials: { openaiApiKey: "sk-test", chatModel: "gpt-4o" },
      }),
    );

    expect(resolved.critiqueModel).toBe("gpt-4o");
    expect(resolved.subjectLineModel).toBe("gpt-4o");
  });
});
