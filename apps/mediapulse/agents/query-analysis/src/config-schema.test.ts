/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { QueryAnalysisConfigSchema } from "./config-schema.js";

describe("QueryAnalysisConfigSchema", () => {
  it("accepts empty config for deterministic-only mode", () => {
    expect(QueryAnalysisConfigSchema.parse({})).toEqual({});
  });

  it("accepts explicit OpenAI credentials", () => {
    expect(
      QueryAnalysisConfigSchema.parse({
        openaiApiKey: "sk-test",
        openaiModel: "gpt-4o-mini",
      }),
    ).toEqual({
      openaiApiKey: "sk-test",
      openaiModel: "gpt-4o-mini",
    });
  });
});
