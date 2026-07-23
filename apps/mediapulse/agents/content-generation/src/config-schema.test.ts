import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { describe, expect, it } from "vitest";

import { fetchProviderEntrySchema } from "@workspace/agent-ingestion";

import {
  CONTENT_GENERATION_CONSTANTS,
  ContentGenerationConfigSchema,
  resolveContentGenerationConfig,
} from "./config-schema.js";

describe("ContentGenerationConfigSchema", () => {
  it("parses empty {} into the two grouped defaults", () => {
    const parsed = ContentGenerationConfigSchema.parse({});

    expect(parsed.model.apiKey).toBe("{{AI_API_KEY}}");
    expect(parsed.model.model).toBe("{{AI_MODEL}}");
    expect(parsed.model.baseUrl).toBe("{{AI_BASE_URL}}");
    expect(parsed.duplicateGuard.timezone).toBe("Asia/Jakarta");
    expect(parsed.maxFetchesPerRun).toBe(18);
    expect(parsed.fetch.providers[0]?.provider).toBe("serper");
    expect(parsed.resilience.deadUrlCache.enabled).toBe(true);
    expect(parsed.resilience.hostErrorBreaker.enabled).toBe(true);
  });

  it("accepts an explicit maxFetchesPerRun and fetch provider chain", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      maxFetchesPerRun: 3,
      fetch: {
        providers: [{ provider: "tavily", apiKey: "sk-fetch" }],
      },
    });

    expect(parsed.maxFetchesPerRun).toBe(3);
    expect(parsed.fetch.providers).toHaveLength(1);
    expect(parsed.fetch.providers[0]?.provider).toBe("tavily");
  });

  it("still parses a stored legacy fetch provider chain", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      fetch: {
        providers: [
          {
            type: "tavily",
            baseUrl: "https://api.tavily.com",
            authentication: { type: "bearer", apiKey: "sk-fetch" },
            rateLimit: { requests: 2, perSeconds: 1 },
          },
        ],
      },
    });

    expect(parsed.fetch.providers[0]).toEqual({
      provider: "tavily",
      apiKey: "sk-fetch",
    });
  });

  it("rejects a misspelled fetch provider name", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      fetch: { providers: [{ provider: "diffbott", apiKey: "sk" }] },
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-positive maxFetchesPerRun", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      maxFetchesPerRun: 0,
    });

    expect(result.success).toBe(false);
  });

  it("parses an explicit model + duplicateGuard config", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      model: {
        apiKey: "sk-test",
        model: "gpt-4o",
        baseUrl: "https://example.com",
      },
      duplicateGuard: { timezone: "America/New_York" },
    });

    expect(parsed.model.apiKey).toBe("sk-test");
    expect(parsed.model.model).toBe("gpt-4o");
    expect(parsed.model.baseUrl).toBe("https://example.com");
    expect(parsed.duplicateGuard.timezone).toBe("America/New_York");
  });

  it("strips unknown legacy groups instead of rejecting them", () => {
    const parsed = ContentGenerationConfigSchema.parse({
      credentials: { openaiApiKey: "sk-legacy" },
      output: { topNewsCount: 5 },
      inputs: { context: { maxCharsPerSource: 1000 } },
      quality: { polish: { enabled: true } },
      translation: { enabled: true, targetLanguages: ["id"] },
      freshness: { strategy: "calendar_day", timezone: "America/New_York" },
    });

    expect(parsed.model.apiKey).toBe("{{AI_API_KEY}}");
    expect(parsed.duplicateGuard.timezone).toBe("Asia/Jakarta");
    expect("credentials" in parsed).toBe(false);
    expect("output" in parsed).toBe(false);
    expect("freshness" in parsed).toBe(false);
    expect("translation" in parsed).toBe(false);
  });

  it("rejects an invalid duplicateGuard timezone", () => {
    const result = ContentGenerationConfigSchema.safeParse({
      duplicateGuard: { timezone: "Not/ATimezone" },
    });

    expect(result.success).toBe(false);
  });

  it("JSON schema exposes the two config sections", () => {
    const jsonSchema = zodToJsonSchema(ContentGenerationConfigSchema, {
      $refStrategy: "none",
    });

    const schemaStr = JSON.stringify(jsonSchema);

    expect(schemaStr).toContain('"model"');
    expect(schemaStr).toContain("apiKey");
    expect(schemaStr).toContain("baseUrl");
    expect(schemaStr).toContain("duplicateGuard");
    expect(schemaStr).toContain("timezone");
  });

  it("publishes the fetch provider enum so Hermes renders a dropdown", () => {
    const jsonSchema = zodToJsonSchema(ContentGenerationConfigSchema, {
      $refStrategy: "none",
    });

    const schemaStr = JSON.stringify(jsonSchema);

    expect(schemaStr).toContain(
      '"enum":["serper","jina","firecrawl","diffbot","tavily","exa"]',
    );
    expect(schemaStr).toContain('"const":"firecrawl_selfhosted"');
  });

  it("publishes a provider schema identical to the unwrapped union", () => {
    const wrapped = zodToJsonSchema(z.array(fetchProviderEntrySchema), {
      $refStrategy: "none",
    });
    const bare = zodToJsonSchema(
      z.array(
        (fetchProviderEntrySchema as z.ZodEffects<z.ZodTypeAny>).innerType(),
      ),
      { $refStrategy: "none" },
    );

    expect(JSON.stringify(wrapped)).toBe(JSON.stringify(bare));
  });
});

describe("resolveContentGenerationConfig", () => {
  it("applies defaults to an empty config", () => {
    const resolved = resolveContentGenerationConfig({});

    expect(resolved.model.apiKey).toBe("{{AI_API_KEY}}");
    expect(resolved.model.model).toBe("{{AI_MODEL}}");
    expect(resolved.duplicateGuard.timezone).toBe("Asia/Jakarta");
  });

  it("passes through an explicit model block unchanged", () => {
    const resolved = resolveContentGenerationConfig({
      model: { apiKey: "sk-key", model: "gpt-4o" },
    });

    expect(resolved.model.apiKey).toBe("sk-key");
    expect(resolved.model.model).toBe("gpt-4o");
  });
});

describe("CONTENT_GENERATION_CONSTANTS", () => {
  it("exposes the demoted hardcoded values", () => {
    expect(CONTENT_GENERATION_CONSTANTS.requestTimeoutMs).toBe(120_000);
    expect(CONTENT_GENERATION_CONSTANTS.truncation.maxCharsPerSource).toBe(
      8000,
    );
    expect(CONTENT_GENERATION_CONSTANTS.truncation.maxTotalContextChars).toBe(
      200_000,
    );
    expect(CONTENT_GENERATION_CONSTANTS.retry.maxAttempts).toBe(3);
    expect(CONTENT_GENERATION_CONSTANTS.retry.baseDelayMs).toBe(500);
    expect(CONTENT_GENERATION_CONSTANTS.retry.maxDelayMs).toBe(8000);
    expect(CONTENT_GENERATION_CONSTANTS.retry.jitter).toBe(true);
    expect(CONTENT_GENERATION_CONSTANTS.coverageSeedSections).toContain(
      "industryPulse",
    );
    expect(CONTENT_GENERATION_CONSTANTS.eventDedup.minSharedAnchors).toBe(4);
    expect(CONTENT_GENERATION_CONSTANTS.crossRunDedup.similarity).toBe(0.55);
  });
});
