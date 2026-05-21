/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { queryAnalysisConfigSchema } from "./config-schema";
import { QUERY_ANALYSIS_LLM_PROMPT_FIELD_MAX_LENGTH } from "./query-analysis-prompt-defaults";

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

  it("rejects unknown template pack names", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      ...minimal,
      templatePack: "unknown",
    });
    expect(result.success).toBe(false);
  });
});

describe("queryAnalysisConfigSchema prompts", () => {
  it("rejects unknown placeholder in systemPrompt", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      ...minimal,
      prompts: { systemPrompt: "{{allowedLanguages}} {{nope}}" },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes("{{nope}}")),
      ).toBe(true);
    }
  });

  it("rejects unknown placeholder in userPromptTemplate", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      ...minimal,
      prompts: { userPromptTemplate: "{{queryContextBlock}} {{bad}}" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects overlong systemPrompt", () => {
    const result = queryAnalysisConfigSchema.safeParse({
      ...minimal,
      prompts: {
        systemPrompt: "x".repeat(
          QUERY_ANALYSIS_LLM_PROMPT_FIELD_MAX_LENGTH + 1,
        ),
      },
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid prompt placeholders", () => {
    const parsed = queryAnalysisConfigSchema.parse({
      ...minimal,
      prompts: {
        systemPrompt: "L: {{allowedLanguages}} B:{{targetBreakingCount}}",
        userPromptTemplate: "CTX:\n{{queryContextBlock}}",
      },
    });
    expect(parsed.prompts?.systemPrompt).toContain("allowedLanguages");
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
