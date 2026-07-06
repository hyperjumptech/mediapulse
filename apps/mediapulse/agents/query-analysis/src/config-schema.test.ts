/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { queryAnalysisConfigSchema } from "./config-schema";

describe("queryAnalysisConfigSchema flat layout", () => {
  it("parses an empty object into the two operator groups with defaults", () => {
    const parsed = queryAnalysisConfigSchema.parse({});

    expect(Object.keys(parsed)).toEqual(["web_search", "ai"]);
    expect(parsed.web_search).toEqual([
      { provider: "serper", apiKey: "{{SERPER_API_KEY}}" },
      { provider: "tavily", apiKey: "{{TAVILY_API_KEY}}" },
      { provider: "exa", apiKey: "{{EXA_API_KEY}}" },
    ]);
    expect(parsed.ai).toEqual({
      apiKey: "{{AI_API_KEY}}",
      model: "{{AI_MODEL}}",
      baseUrl: "{{AI_BASE_URL}}",
    });
  });

  it("preserves Hermes variable placeholders verbatim", () => {
    const parsed = queryAnalysisConfigSchema.parse({});

    expect(parsed.web_search[0]?.apiKey).toBe("{{SERPER_API_KEY}}");
    expect(parsed.ai.apiKey).toBe("{{AI_API_KEY}}");
    expect(parsed.ai.model).toBe("{{AI_MODEL}}");
    expect(parsed.ai.baseUrl).toBe("{{AI_BASE_URL}}");
  });

  it("accepts a custom provider pool and ai overrides", () => {
    const parsed = queryAnalysisConfigSchema.parse({
      web_search: [{ provider: "serper", apiKey: "sk-serper" }],
      ai: { apiKey: "sk-ai", model: "gpt-4o-mini", baseUrl: "https://gw" },
    });

    expect(parsed.web_search).toEqual([
      { provider: "serper", apiKey: "sk-serper" },
    ]);
    expect(parsed.ai).toEqual({
      apiKey: "sk-ai",
      model: "gpt-4o-mini",
      baseUrl: "https://gw",
    });
  });

  it("rejects an empty provider pool", () => {
    const result = queryAnalysisConfigSchema.safeParse({ web_search: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown search provider", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      web_search: [{ provider: "google", apiKey: "x" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("queryAnalysisConfigSchema strict mode", () => {
  it.each([
    "credentials",
    "output",
    "prompting",
    "creativity",
    "quality",
    "dynamics",
    "queryCount",
    "personas",
    "semanticDedupe",
    "diversityGate",
    "temporalBias",
    "yieldFeedback",
    "web_fetch",
    "relevance",
  ])("rejects the removed/unknown key %s under strict mode", (key) => {
    const result = queryAnalysisConfigSchema.safeParse({ [key]: {} });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.toLowerCase().includes("unrecognized"),
        ),
      ).toBe(true);
    }
  });
});
