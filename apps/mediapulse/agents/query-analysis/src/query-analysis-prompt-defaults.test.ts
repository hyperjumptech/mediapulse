/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  QUERY_ANALYSIS_INTENT_TARGET_PLACEHOLDERS,
  QUERY_ANALYSIS_SYSTEM_PROMPT_TEMPLATE_DEFAULT,
  QUERY_ANALYSIS_USER_PROMPT_TEMPLATE_DEFAULT,
} from "./query-analysis-prompt-defaults";

describe("query-analysis default prompt templates", () => {
  it("system default lists all system placeholders", () => {
    expect(QUERY_ANALYSIS_SYSTEM_PROMPT_TEMPLATE_DEFAULT).toContain(
      "{{allowedLanguages}}",
    );
    expect(QUERY_ANALYSIS_SYSTEM_PROMPT_TEMPLATE_DEFAULT).toContain(
      "{{targetBreakingCount}}",
    );
    expect(QUERY_ANALYSIS_SYSTEM_PROMPT_TEMPLATE_DEFAULT).toContain(
      "{{targetKgCount}}",
    );
    expect(QUERY_ANALYSIS_SYSTEM_PROMPT_TEMPLATE_DEFAULT).toContain(
      "{{targetFundamentalCount}}",
    );
    expect(QUERY_ANALYSIS_SYSTEM_PROMPT_TEMPLATE_DEFAULT).toContain(
      "{{targetEsgCount}}",
    );
    expect(QUERY_ANALYSIS_SYSTEM_PROMPT_TEMPLATE_DEFAULT).toContain(
      "{{targetTechnicalCount}}",
    );
    expect(QUERY_ANALYSIS_SYSTEM_PROMPT_TEMPLATE_DEFAULT).toContain(
      "{{minDeterministicCount}}",
    );
    expect(QUERY_ANALYSIS_SYSTEM_PROMPT_TEMPLATE_DEFAULT).toContain("esg");
    expect(QUERY_ANALYSIS_SYSTEM_PROMPT_TEMPLATE_DEFAULT).toContain(
      "supply_chain",
    );
  });

  it("maps every intent to a target-count placeholder", () => {
    expect(Object.keys(QUERY_ANALYSIS_INTENT_TARGET_PLACEHOLDERS)).toHaveLength(
      9,
    );
  });

  it("user default is queryContextBlock only", () => {
    expect(QUERY_ANALYSIS_USER_PROMPT_TEMPLATE_DEFAULT).toBe(
      "{{queryContextBlock}}",
    );
  });
});
