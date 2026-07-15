import { describe, expect, it } from "vitest";

import {
  ARTICLE_ANALYSIS_AGENT_ID,
  ARTICLE_ANALYSIS_AGENT_VERSION,
} from "./constants";

describe("article-analysis constants", () => {
  it("exposes the stable agent identity", () => {
    expect(ARTICLE_ANALYSIS_AGENT_ID).toBe("article-analysis");
    expect(ARTICLE_ANALYSIS_AGENT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
