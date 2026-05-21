/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  queryAnalysisIntentSchema,
  queryAnalysisPostQuerySchema,
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

  it("rejects unknown intent labels", () => {
    const result = queryAnalysisIntentSchema.safeParse("unknown_intent");
    expect(result.success).toBe(false);
  });
});
