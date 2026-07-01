import { describe, expect, it } from "vitest";

import {
  articleAnalysisRunStatusSchema,
  postArticleAnalysisRunBodySchema,
} from "./article-analysis-run.js";

describe("postArticleAnalysisRunBodySchema", () => {
  const base = {
    id: "11111111-1111-4111-a111-111111111111",
    startedAt: "2026-06-30T06:04:24.000Z",
    completedAt: "2026-06-30T06:05:02.000Z",
    status: "success" as const,
  };

  it("applies zero defaults for token and count fields", () => {
    const parsed = postArticleAnalysisRunBodySchema.parse(base);

    expect(parsed.promptTokens).toBe(0);
    expect(parsed.completionTokens).toBe(0);
    expect(parsed.totalTokens).toBe(0);
    expect(parsed.scored).toBe(0);
    expect(parsed.rejected).toBe(0);
    expect(parsed.backlog).toBe(0);
  });

  it("accepts a fully populated run record", () => {
    const parsed = postArticleAnalysisRunBodySchema.parse({
      ...base,
      model: "gpt-4o-mini",
      promptTokens: 18_900,
      completionTokens: 3_400,
      totalTokens: 22_300,
      scored: 41,
      rejected: 48,
      backlog: 0,
      stopReason: "drained",
      durationMs: 38_000,
    });

    expect(parsed.model).toBe("gpt-4o-mini");
    expect(parsed.totalTokens).toBe(22_300);
    expect(parsed.stopReason).toBe("drained");
  });

  it("rejects an unknown status", () => {
    expect(articleAnalysisRunStatusSchema.safeParse("weird").success).toBe(
      false,
    );
  });
});
