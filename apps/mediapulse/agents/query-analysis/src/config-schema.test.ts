/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS } from "@workspace/agent-data-api-contract";

import {
  queryAnalysisConfigSchema,
  resolveIntentWeights,
} from "./config-schema";

/** Parses config with a resolved API key while keeping other schema defaults. */
const parseWithApiKey = (
  overrides: z.input<typeof queryAnalysisConfigSchema> = {},
) =>
  queryAnalysisConfigSchema.parse({
    credentials: { openaiApiKey: "sk-test" },
    ...overrides,
  });

describe("queryAnalysisConfigSchema grouped layout", () => {
  it("parses an empty object into the full recommended config", () => {
    const parsed = queryAnalysisConfigSchema.parse({});

    expect(Object.keys(parsed)).toEqual([
      "credentials",
      "output",
      "sampling",
      "templates",
      "prompting",
      "creativity",
      "quality",
      "dynamics",
    ]);
    expect(parsed.credentials).toEqual({
      openaiApiKey: "{{OPENAI_API_KEY}}",
      chatModel: "{{QUERY_ANALYSIS_MODEL}}",
    });
    expect(parsed.output.queryCount).toBe(10);
    expect(parsed.output.languageQuotas).toBeUndefined();
    expect(parsed.sampling).toEqual({
      temperature: 0.9,
      topP: 0.95,
      presencePenalty: 0.4,
      frequencyPenalty: 0.5,
    });
    expect(parsed.templates).toEqual({
      templatePack: "default-v1",
      kgTemplateCap: 6,
    });
    expect(parsed.prompting).toEqual({
      personas: ["analyst", "retail", "regulator"],
      perPersonaQuotaCount: 3,
      fewShotExemplarCount: 3,
    });
    expect(parsed.creativity).toEqual({
      wildcardFraction: 0.1,
      wildcardTemperature: 1.2,
      useBrainstormPass: false,
    });
    expect(parsed.quality.semanticDedupe).toEqual({
      enabled: false,
      threshold: 0.85,
      embeddingModel: "{{EMBEDDING_MODEL}}",
    });
    expect(parsed.quality.diversityGate).toEqual({
      enabled: false,
      threshold: 0.6,
      weights: { lexical: 0.4, intent: 0.3, semantic: 0.3 },
    });
    expect(parsed.quality.useSelfCritique).toBe(false);
    expect(parsed.quality.critiqueDropFraction).toBe(0.25);
    expect(parsed.dynamics.temporalBias).toEqual({ enabled: true });
    expect(parsed.dynamics.yieldFeedback).toEqual({
      enabled: false,
      windowDays: 30,
      minTemplateYield: 0.05,
    });
  });

  it("preserves Hermes variable placeholders verbatim", () => {
    const parsed = queryAnalysisConfigSchema.parse({});

    expect(parsed.credentials.openaiApiKey).toBe("{{OPENAI_API_KEY}}");
    expect(parsed.credentials.chatModel).toBe("{{QUERY_ANALYSIS_MODEL}}");
    expect(parsed.quality.semanticDedupe.embeddingModel).toBe(
      "{{EMBEDDING_MODEL}}",
    );
  });

  it("rejects legacy flat top-level keys under strict mode", () => {
    const flatKeys = [
      "openaiApiKey",
      "openaiModel",
      "queryCount",
      "temperature",
      "templatePack",
      "semanticDedupe",
      "diversityGate",
      "temporalBias",
      "yieldFeedback",
    ] as const;

    for (const key of flatKeys) {
      const result = queryAnalysisConfigSchema.safeParse({
        credentials: { openaiApiKey: "sk-test" },
        [key]: key === "openaiApiKey" ? "sk-test" : "x",
      });
      expect(result.success).toBe(false);
    }
  });
});

describe("queryAnalysisConfigSchema templates", () => {
  it("defaults templatePack to default-v1", () => {
    const parsed = parseWithApiKey();
    expect(parsed.templates.templatePack).toBe("default-v1");
  });

  it("accepts rich-v2 template pack", () => {
    const parsed = parseWithApiKey({
      templates: { templatePack: "rich-v2" },
    });
    expect(parsed.templates.templatePack).toBe("rich-v2");
  });

  it("accepts rich-v2-extended template pack", () => {
    const parsed = parseWithApiKey({
      templates: { templatePack: "rich-v2-extended" },
    });
    expect(parsed.templates.templatePack).toBe("rich-v2-extended");
  });

  it("accepts kg-aware-v1 template pack", () => {
    const parsed = parseWithApiKey({
      templates: { templatePack: "kg-aware-v1" },
    });
    expect(parsed.templates.templatePack).toBe("kg-aware-v1");
  });

  it("rejects unknown template pack names", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      credentials: { openaiApiKey: "sk-test" },
      templates: { templatePack: "unknown" },
    });
    expect(result.success).toBe(false);
  });

  it("defaults kgTemplateCap to 6", () => {
    const parsed = parseWithApiKey();
    expect(parsed.templates.kgTemplateCap).toBe(6);
  });
});

describe("resolveIntentWeights", () => {
  it("returns defaults when intentWeights is omitted", () => {
    const parsed = parseWithApiKey();
    expect(resolveIntentWeights(parsed.output)).toEqual(
      DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
    );
  });

  it("parses nested intentWeights from the output group", () => {
    const parsed = parseWithApiKey({
      output: { intentWeights: { breaking: 2, kg_change: 1.1 } },
    });

    expect(resolveIntentWeights(parsed.output)).toMatchObject({
      breaking: 2,
      kg_change: 1.1,
    });
  });
});

describe("queryAnalysisConfigSchema strict mode", () => {
  it("rejects legacy prompts overrides with an unrecognized key error", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      credentials: { openaiApiKey: "sk-test" },
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
      credentials: { openaiApiKey: "sk-test" },
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
      credentials: { openaiApiKey: "sk-test" },
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
      credentials: { openaiApiKey: "sk-test" },
      weightBreaking: 2,
    });
    expect(result.success).toBe(false);
  });

  it("rejects legacy allowedLanguages config key under strict mode", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      credentials: { openaiApiKey: "sk-test" },
      allowedLanguages: ["en", "id"],
    });
    expect(result.success).toBe(false);
  });
});

describe("queryAnalysisConfigSchema sampling", () => {
  it("defaults creativity sampling fields", () => {
    const parsed = parseWithApiKey();
    expect(parsed.sampling.temperature).toBe(0.9);
    expect(parsed.sampling.topP).toBe(0.95);
    expect(parsed.sampling.presencePenalty).toBe(0.4);
    expect(parsed.sampling.frequencyPenalty).toBe(0.5);
    expect(parsed.sampling.seed).toBeUndefined();
  });

  it("rejects temperature above 2", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      credentials: { openaiApiKey: "sk-test" },
      sampling: { temperature: 2.1 },
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
      credentials: { openaiApiKey: "sk-test" },
      sampling: { presencePenalty: 3 },
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
      credentials: { openaiApiKey: "sk-test" },
      sampling: { seed: 1.5 },
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
    const parsed = parseWithApiKey();
    expect(parsed.creativity.useBrainstormPass).toBe(false);
    expect(parsed.prompting.fewShotExemplarCount).toBe(3);
    expect(parsed.creativity.brainstormModel).toBeUndefined();
  });

  it("accepts brainstorm and few-shot overrides", () => {
    const parsed = parseWithApiKey({
      creativity: { useBrainstormPass: true, brainstormModel: "gpt-4o" },
      prompting: { fewShotExemplarCount: 0 },
    });
    expect(parsed.creativity.useBrainstormPass).toBe(true);
    expect(parsed.creativity.brainstormModel).toBe("gpt-4o");
    expect(parsed.prompting.fewShotExemplarCount).toBe(0);
  });

  it("rejects fewShotExemplarCount above 6", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      credentials: { openaiApiKey: "sk-test" },
      prompting: { fewShotExemplarCount: 7 },
    });
    expect(result.success).toBe(false);
  });
});

describe("queryAnalysisConfigSchema personas", () => {
  it("defaults personas and perPersonaQuotaCount", () => {
    const parsed = parseWithApiKey();
    expect(parsed.prompting.personas).toEqual([
      "analyst",
      "retail",
      "regulator",
    ]);
    expect(parsed.prompting.perPersonaQuotaCount).toBe(3);
  });

  it("accepts persona overrides", () => {
    const parsed = parseWithApiKey({
      prompting: { personas: ["esg", "short_seller"], perPersonaQuotaCount: 2 },
    });
    expect(parsed.prompting.personas).toEqual(["esg", "short_seller"]);
    expect(parsed.prompting.perPersonaQuotaCount).toBe(2);
  });
});

describe("queryAnalysisConfigSchema self-critique", () => {
  it("defaults useSelfCritique to false and critiqueDropFraction to 0.25", () => {
    const parsed = parseWithApiKey();
    expect(parsed.quality.useSelfCritique).toBe(false);
    expect(parsed.quality.critiqueDropFraction).toBe(0.25);
    expect(parsed.quality.critiqueModel).toBeUndefined();
  });

  it("accepts self-critique overrides", () => {
    const parsed = parseWithApiKey({
      quality: {
        useSelfCritique: true,
        critiqueDropFraction: 0.2,
        critiqueModel: "gpt-4o",
      },
    });
    expect(parsed.quality.useSelfCritique).toBe(true);
    expect(parsed.quality.critiqueDropFraction).toBe(0.2);
    expect(parsed.quality.critiqueModel).toBe("gpt-4o");
  });

  it("rejects critiqueDropFraction above 0.5", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      credentials: { openaiApiKey: "sk-test" },
      quality: { critiqueDropFraction: 0.6 },
    });
    expect(result.success).toBe(false);
  });
});

describe("queryAnalysisConfigSchema semanticDedupe", () => {
  it("defaults semantic dedupe to disabled with placeholder embedding model", () => {
    const parsed = parseWithApiKey();
    expect(parsed.quality.semanticDedupe).toEqual({
      enabled: false,
      threshold: 0.85,
      embeddingModel: "{{EMBEDDING_MODEL}}",
    });
  });

  it("accepts semantic dedupe overrides", () => {
    const parsed = parseWithApiKey({
      quality: {
        semanticDedupe: {
          enabled: true,
          threshold: 0.9,
          embeddingModel: "text-embedding-3-large",
        },
      },
    });
    expect(parsed.quality.semanticDedupe.enabled).toBe(true);
    expect(parsed.quality.semanticDedupe.threshold).toBe(0.9);
    expect(parsed.quality.semanticDedupe.embeddingModel).toBe(
      "text-embedding-3-large",
    );
  });

  it("rejects semantic dedupe threshold above 1", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      credentials: { openaiApiKey: "sk-test" },
      quality: { semanticDedupe: { enabled: true, threshold: 1.1 } },
    });
    expect(result.success).toBe(false);
  });
});

describe("queryAnalysisConfigSchema diversityGate", () => {
  it("defaults diversity gate to disabled with recommended weights", () => {
    const parsed = parseWithApiKey();
    expect(parsed.quality.diversityGate).toEqual({
      enabled: false,
      threshold: 0.6,
      weights: { lexical: 0.4, intent: 0.3, semantic: 0.3 },
    });
  });

  it("accepts diversity gate overrides", () => {
    const parsed = parseWithApiKey({
      quality: {
        diversityGate: {
          enabled: true,
          threshold: 0.75,
          weights: { lexical: 0.5, intent: 0.25, semantic: 0.25 },
        },
      },
    });
    expect(parsed.quality.diversityGate.enabled).toBe(true);
    expect(parsed.quality.diversityGate.threshold).toBe(0.75);
    expect(parsed.quality.diversityGate.weights.lexical).toBe(0.5);
  });

  it("rejects diversity gate threshold above 1", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      credentials: { openaiApiKey: "sk-test" },
      quality: { diversityGate: { enabled: true, threshold: 1.2 } },
    });
    expect(result.success).toBe(false);
  });
});

describe("queryAnalysisConfigSchema temporalBias", () => {
  it("defaults temporalBias.enabled to true", () => {
    const parsed = parseWithApiKey();
    expect(parsed.dynamics.temporalBias.enabled).toBe(true);
  });

  it("honors temporalBias.enabled=false", () => {
    const parsed = parseWithApiKey({
      dynamics: { temporalBias: { enabled: false } },
    });
    expect(parsed.dynamics.temporalBias.enabled).toBe(false);
  });
});

describe("queryAnalysisConfigSchema yieldFeedback", () => {
  it("defaults yield feedback to disabled with a 30-day window", () => {
    const parsed = parseWithApiKey();
    expect(parsed.dynamics.yieldFeedback).toEqual({
      enabled: false,
      windowDays: 30,
      minTemplateYield: 0.05,
    });
  });

  it("parses enabled yield feedback overrides from Hermes config", () => {
    const parsed = parseWithApiKey({
      dynamics: {
        yieldFeedback: {
          enabled: true,
          windowDays: 14,
          minTemplateYield: 0.1,
        },
      },
    });
    expect(parsed.dynamics.yieldFeedback).toEqual({
      enabled: true,
      windowDays: 14,
      minTemplateYield: 0.1,
    });
  });
});

describe("queryAnalysisConfigSchema languageQuotas", () => {
  it("accepts valid languageQuotas whose shares sum to 1.0", () => {
    const parsed = parseWithApiKey({
      output: {
        languageQuotas: [
          { language: "en", share: 0.6 },
          { language: "id", share: 0.4 },
        ],
      },
    });
    expect(parsed.output.languageQuotas).toEqual([
      { language: "en", share: 0.6 },
      { language: "id", share: 0.4 },
    ]);
  });

  it("rejects languageQuotas shares summing to 0.99", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      credentials: { openaiApiKey: "sk-test" },
      output: {
        languageQuotas: [
          { language: "en", share: 0.59 },
          { language: "id", share: 0.4 },
        ],
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.includes("languageQuotas shares must sum to 1.0"),
        ),
      ).toBe(true);
      expect(
        result.error.issues.some(
          (issue) =>
            issue.path.includes("output") &&
            issue.path.includes("languageQuotas"),
        ),
      ).toBe(true);
    }
  });

  it("rejects languageQuotas shares summing to 1.01", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      credentials: { openaiApiKey: "sk-test" },
      output: {
        languageQuotas: [
          { language: "en", share: 0.61 },
          { language: "id", share: 0.4 },
        ],
      },
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
