/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS } from "@workspace/agent-data-api-contract";

import {
  queryAnalysisConfigSchema,
  resolveIntentWeights,
  resolveYieldFeedbackConfig,
} from "./config-schema";

const minimal = { openaiApiKey: "sk-test" } satisfies Parameters<
  typeof queryAnalysisConfigSchema.parse
>[0];

describe("queryAnalysisConfigSchema templatePack", () => {
  it("defaults templatePack to default-v1", () => {
    const parsed = queryAnalysisConfigSchema.parse(minimal);
    expect(parsed.templatePack).toBe("default-v1");
  });

  it("accepts rich-v2 template pack", () => {
    const parsed = queryAnalysisConfigSchema.parse({
      ...minimal,
      templatePack: "rich-v2",
    });
    expect(parsed.templatePack).toBe("rich-v2");
  });

  it("accepts rich-v2-extended template pack", () => {
    const parsed = queryAnalysisConfigSchema.parse({
      ...minimal,
      templatePack: "rich-v2-extended",
    });
    expect(parsed.templatePack).toBe("rich-v2-extended");
  });

  it("accepts kg-aware-v1 template pack", () => {
    const parsed = queryAnalysisConfigSchema.parse({
      ...minimal,
      templatePack: "kg-aware-v1",
    });
    expect(parsed.templatePack).toBe("kg-aware-v1");
  });

  it("rejects unknown template pack names", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      ...minimal,
      templatePack: "unknown",
    });
    expect(result.success).toBe(false);
  });

  it("defaults kgTemplateCap to 6", () => {
    const parsed = queryAnalysisConfigSchema.parse(minimal);
    expect(parsed.kgTemplateCap).toBe(6);
  });
});

describe("resolveIntentWeights", () => {
  it("returns defaults when intentWeights is omitted", () => {
    const parsed = queryAnalysisConfigSchema.parse(minimal);
    expect(resolveIntentWeights(parsed)).toEqual(
      DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
    );
  });

  it("parses nested intentWeights from modern Hermes config", () => {
    const parsed = queryAnalysisConfigSchema.parse({
      ...minimal,
      intentWeights: { breaking: 2, kg_change: 1.1 },
    });

    expect(resolveIntentWeights(parsed)).toMatchObject({
      breaking: 2,
      kg_change: 1.1,
    });
  });
});

describe("queryAnalysisConfigSchema strict mode", () => {
  it("rejects legacy prompts overrides with an unrecognized key error", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      ...minimal,
      prompts: {
        systemPrompt: "Custom system prompt",
        userPromptTemplate: "{{queryContextBlock}}",
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.toLowerCase().includes("unrecognized"),
        ),
      ).toBe(true);
    }
  });

  it("rejects removed maxTokens config key under strict mode", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      ...minimal,
      maxTokens: 1200,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.toLowerCase().includes("unrecognized"),
        ),
      ).toBe(true);
    }
  });

  it("rejects removed minDeterministicCount config key under strict mode", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      ...minimal,
      minDeterministicCount: 4,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.toLowerCase().includes("unrecognized"),
        ),
      ).toBe(true);
    }
  });

  it("rejects legacy weightBreaking config key under strict mode", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      ...minimal,
      weightBreaking: 2,
    });
    expect(result.success).toBe(false);
  });

  it("rejects legacy allowedLanguages config key under strict mode", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      ...minimal,
      allowedLanguages: ["en", "id"],
    });
    expect(result.success).toBe(false);
  });
});

describe("queryAnalysisConfigSchema sampling", () => {
  it("defaults creativity sampling fields", () => {
    const parsed = queryAnalysisConfigSchema.parse(minimal);
    expect(parsed.temperature).toBe(0.9);
    expect(parsed.topP).toBe(0.95);
    expect(parsed.presencePenalty).toBe(0.4);
    expect(parsed.frequencyPenalty).toBe(0.5);
    expect(parsed.seed).toBeUndefined();
  });

  it("rejects temperature above 2", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      ...minimal,
      temperature: 2.1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.includes("temperature")),
      ).toBe(true);
    }
  });

  it("rejects presencePenalty above 2", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      ...minimal,
      presencePenalty: 3,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.path.includes("presencePenalty"),
        ),
      ).toBe(true);
    }
  });

  it("rejects non-integer seed values", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      ...minimal,
      seed: 1.5,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.includes("seed")),
      ).toBe(true);
    }
  });
});

describe("queryAnalysisConfigSchema brainstorm and few-shot", () => {
  it("defaults useBrainstormPass to false and fewShotExemplarCount to 3", () => {
    const parsed = queryAnalysisConfigSchema.parse(minimal);
    expect(parsed.useBrainstormPass).toBe(false);
    expect(parsed.fewShotExemplarCount).toBe(3);
    expect(parsed.brainstormModel).toBeUndefined();
  });

  it("accepts brainstorm and few-shot overrides", () => {
    const parsed = queryAnalysisConfigSchema.parse({
      ...minimal,
      useBrainstormPass: true,
      brainstormModel: "gpt-4o",
      fewShotExemplarCount: 0,
    });
    expect(parsed.useBrainstormPass).toBe(true);
    expect(parsed.brainstormModel).toBe("gpt-4o");
    expect(parsed.fewShotExemplarCount).toBe(0);
  });

  it("rejects fewShotExemplarCount above 6", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      ...minimal,
      fewShotExemplarCount: 7,
    });
    expect(result.success).toBe(false);
  });
});

describe("queryAnalysisConfigSchema personas", () => {
  it("defaults personas and perPersonaQuotaCount", () => {
    const parsed = queryAnalysisConfigSchema.parse(minimal);
    expect(parsed.personas).toEqual(["analyst", "retail", "regulator"]);
    expect(parsed.perPersonaQuotaCount).toBe(3);
  });

  it("accepts persona overrides", () => {
    const parsed = queryAnalysisConfigSchema.parse({
      ...minimal,
      personas: ["esg", "short_seller"],
      perPersonaQuotaCount: 2,
    });
    expect(parsed.personas).toEqual(["esg", "short_seller"]);
    expect(parsed.perPersonaQuotaCount).toBe(2);
  });
});

describe("queryAnalysisConfigSchema self-critique", () => {
  it("defaults useSelfCritique to false and critiqueDropFraction to 0.25", () => {
    const parsed = queryAnalysisConfigSchema.parse(minimal);
    expect(parsed.useSelfCritique).toBe(false);
    expect(parsed.critiqueDropFraction).toBe(0.25);
    expect(parsed.critiqueModel).toBeUndefined();
  });

  it("accepts self-critique overrides", () => {
    const parsed = queryAnalysisConfigSchema.parse({
      ...minimal,
      useSelfCritique: true,
      critiqueDropFraction: 0.2,
      critiqueModel: "gpt-4o",
    });
    expect(parsed.useSelfCritique).toBe(true);
    expect(parsed.critiqueDropFraction).toBe(0.2);
    expect(parsed.critiqueModel).toBe("gpt-4o");
  });

  it("rejects critiqueDropFraction above 0.5", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      ...minimal,
      critiqueDropFraction: 0.6,
    });
    expect(result.success).toBe(false);
  });
});

describe("queryAnalysisConfigSchema semanticDedupe", () => {
  it("defaults semantic dedupe to disabled when omitted", () => {
    const parsed = queryAnalysisConfigSchema.parse(minimal);
    expect(parsed.semanticDedupe).toBeUndefined();
  });

  it("accepts semantic dedupe overrides", () => {
    const parsed = queryAnalysisConfigSchema.parse({
      ...minimal,
      semanticDedupe: {
        enabled: true,
        threshold: 0.9,
        embeddingModel: "text-embedding-3-large",
      },
    });
    expect(parsed.semanticDedupe?.enabled).toBe(true);
    expect(parsed.semanticDedupe?.threshold).toBe(0.9);
    expect(parsed.semanticDedupe?.embeddingModel).toBe(
      "text-embedding-3-large",
    );
  });

  it("rejects semantic dedupe threshold above 1", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      ...minimal,
      semanticDedupe: { enabled: true, threshold: 1.1 },
    });
    expect(result.success).toBe(false);
  });
});

describe("queryAnalysisConfigSchema diversityGate", () => {
  it("defaults diversity gate to disabled when omitted", () => {
    const parsed = queryAnalysisConfigSchema.parse(minimal);
    expect(parsed.diversityGate).toBeUndefined();
  });

  it("accepts diversity gate overrides", () => {
    const parsed = queryAnalysisConfigSchema.parse({
      ...minimal,
      diversityGate: {
        enabled: true,
        threshold: 0.75,
        weights: { lexical: 0.5, intent: 0.25, semantic: 0.25 },
      },
    });
    expect(parsed.diversityGate?.enabled).toBe(true);
    expect(parsed.diversityGate?.threshold).toBe(0.75);
    expect(parsed.diversityGate?.weights?.lexical).toBe(0.5);
  });

  it("rejects diversity gate threshold above 1", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      ...minimal,
      diversityGate: { enabled: true, threshold: 1.2 },
    });
    expect(result.success).toBe(false);
  });
});

describe("resolveDiversityGateConfig", () => {
  it("returns schema defaults when diversityGate is omitted", async () => {
    const { resolveDiversityGateConfig } = await import("./config-schema");
    expect(resolveDiversityGateConfig({})).toEqual({
      enabled: false,
      threshold: 0.6,
      weights: { lexical: 0.4, intent: 0.3, semantic: 0.3 },
    });
  });
});

describe("resolveTemporalBiasConfig", () => {
  it("defaults temporal bias to enabled", async () => {
    const { resolveTemporalBiasConfig } = await import("./config-schema");
    expect(resolveTemporalBiasConfig({})).toEqual({ enabled: true });
  });

  it("honors temporalBias.enabled=false", async () => {
    const { resolveTemporalBiasConfig } = await import("./config-schema");
    expect(
      resolveTemporalBiasConfig({ temporalBias: { enabled: false } }),
    ).toEqual({ enabled: false });
  });
});

describe("queryAnalysisConfigSchema temporalBias", () => {
  it("defaults temporalBias.enabled to true when the object is present", () => {
    const parsed = queryAnalysisConfigSchema.parse({
      ...minimal,
      temporalBias: {},
    });
    expect(parsed.temporalBias?.enabled).toBe(true);
  });
});

describe("queryAnalysisConfigSchema languageQuotas", () => {
  it("accepts valid languageQuotas whose shares sum to 1.0", () => {
    const parsed = queryAnalysisConfigSchema.parse({
      ...minimal,
      languageQuotas: [
        { language: "en", share: 0.6 },
        { language: "id", share: 0.4 },
      ],
    });
    expect(parsed.languageQuotas).toEqual([
      { language: "en", share: 0.6 },
      { language: "id", share: 0.4 },
    ]);
  });

  it("rejects languageQuotas shares summing to 0.99", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      ...minimal,
      languageQuotas: [
        { language: "en", share: 0.59 },
        { language: "id", share: 0.4 },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.includes("languageQuotas shares must sum to 1.0"),
        ),
      ).toBe(true);
    }
  });

  it("rejects languageQuotas shares summing to 1.01", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      ...minimal,
      languageQuotas: [
        { language: "en", share: 0.61 },
        { language: "id", share: 0.4 },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.includes("languageQuotas shares must sum to 1.0"),
        ),
      ).toBe(true);
    }
  });
});

describe("resolveYieldFeedbackConfig", () => {
  it("defaults yield feedback to disabled with a 30-day window", () => {
    expect(resolveYieldFeedbackConfig({})).toEqual({
      enabled: false,
      windowDays: 30,
      minTemplateYield: 0.05,
    });
  });

  it("parses enabled yield feedback overrides from Hermes config", () => {
    const parsed = queryAnalysisConfigSchema.parse({
      ...minimal,
      yieldFeedback: {
        enabled: true,
        windowDays: 14,
        minTemplateYield: 0.1,
      },
    });
    expect(resolveYieldFeedbackConfig(parsed)).toEqual({
      enabled: true,
      windowDays: 14,
      minTemplateYield: 0.1,
    });
  });
});
