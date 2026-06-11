/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  queryAnalysisIntentSchema,
  queryAnalysisPostQuerySchema,
  queryAnalysisPriorYieldSchema,
} from "./query-analysis.js";

describe("queryAnalysisIntentSchema", () => {
  it("accepts legacy breaking intent rows", () => {
    const parsed = queryAnalysisPostQuerySchema.parse({
      text: "ACME latest news",
      source: "deterministic",
      intent: "breaking",
      rank: 1,
    });
    expect(parsed.intent).toBe("breaking");
  });

  it("accepts new esg intent rows", () => {
    const parsed = queryAnalysisPostQuerySchema.parse({
      text: "Acme Co ESG controversies",
      source: "llm",
      intent: "esg",
      rank: 3,
    });
    expect(parsed.intent).toBe("esg");
  });

  it("accepts industry-focused intent rows", () => {
    const parsed = queryAnalysisPostQuerySchema.parse({
      text: "Indonesian telecom regulatory licensing",
      source: "deterministic",
      intent: "regulatory",
      rank: 4,
    });
    expect(parsed.intent).toBe("regulatory");
  });

  it("accepts wildcard intent rows", () => {
    const parsed = queryAnalysisPostQuerySchema.parse({
      text: "Oblique cultural narrative angle",
      source: "llm",
      intent: "wildcard",
      rank: 10,
    });
    expect(parsed.intent).toBe("wildcard");
  });

  it("rejects unknown intent labels", () => {
    const result = queryAnalysisIntentSchema.safeParse("unknown_intent");
    expect(result.success).toBe(false);
  });
});

describe("queryAnalysisPriorYieldSchema", () => {
  it("accepts rolling yield rollups on GET /query-analysis responses", () => {
    const parsed = queryAnalysisPriorYieldSchema.parse({
      perIntent: [{ intent: "fundamental", avgArticles: 3.2, avgNovel: 3.2 }],
      perPersona: [{ persona: "analyst", avgArticles: 1, avgNovel: 0.5 }],
    });
    expect(parsed.perIntent[0]?.intent).toBe("fundamental");
  });
});
