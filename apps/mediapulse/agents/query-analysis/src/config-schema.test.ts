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
