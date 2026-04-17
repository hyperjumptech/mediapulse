/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deriveArticleAnalysisRunStatusLabel,
  isArticleAnalysisExtractionPolicyFailure,
} from "./article-analysis-run-policy.js";

describe("isArticleAnalysisExtractionPolicyFailure", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false when failOnZeroSuccess is false", () => {
    expect(
      isArticleAnalysisExtractionPolicyFailure(0, {
        minSuccessfulSources: 1,
        failOnZeroSuccess: false,
      }),
    ).toBe(false);
  });

  it("returns true when successes are below minimum and failOnZeroSuccess is true", () => {
    expect(
      isArticleAnalysisExtractionPolicyFailure(0, {
        minSuccessfulSources: 1,
        failOnZeroSuccess: true,
      }),
    ).toBe(true);

    expect(
      isArticleAnalysisExtractionPolicyFailure(1, {
        minSuccessfulSources: 2,
        failOnZeroSuccess: true,
      }),
    ).toBe(true);
  });

  it("returns false when successes meet or exceed minimum", () => {
    expect(
      isArticleAnalysisExtractionPolicyFailure(1, {
        minSuccessfulSources: 1,
        failOnZeroSuccess: true,
      }),
    ).toBe(false);

    expect(
      isArticleAnalysisExtractionPolicyFailure(2, {
        minSuccessfulSources: 1,
        failOnZeroSuccess: true,
      }),
    ).toBe(false);
  });

  it("returns false when minimum is zero even if no successes", () => {
    expect(
      isArticleAnalysisExtractionPolicyFailure(0, {
        minSuccessfulSources: 0,
        failOnZeroSuccess: true,
      }),
    ).toBe(false);
  });
});

describe("deriveArticleAnalysisRunStatusLabel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns success when there are no failures", () => {
    expect(deriveArticleAnalysisRunStatusLabel(0, 0)).toBe("success");
  });

  it("returns partial_success when there were extraction failures", () => {
    expect(deriveArticleAnalysisRunStatusLabel(1, 0)).toBe("partial_success");
  });

  it("returns partial_success when there were POST failures", () => {
    expect(deriveArticleAnalysisRunStatusLabel(0, 1)).toBe("partial_success");
  });
});
