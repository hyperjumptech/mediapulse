/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  buildQueryAnalysisConfigSnapshot,
  parseAllowedLanguages,
} from "./build-query-analysis-config-snapshot.js";
import type { MediapulseEnvLike } from "./query-analysis-env-types.js";

describe("parseAllowedLanguages", () => {
  it("parses a JSON array string", () => {
    expect(parseAllowedLanguages('["en","de"]')).toEqual(["en", "de"]);
  });

  it("falls back when JSON is invalid", () => {
    expect(parseAllowedLanguages("not-json")).toEqual(["en"]);
  });
});

describe("buildQueryAnalysisConfigSnapshot", () => {
  it("applies numeric defaults for missing env fields", () => {
    const envLike = {
      QUERY_ANALYSIS_ALLOWED_LANGUAGES: '["en"]',
    } as MediapulseEnvLike;

    const snap = buildQueryAnalysisConfigSnapshot(envLike);

    expect(snap.queryCount).toBe(10);
    expect(snap.minDeterministicCount).toBe(3);
    expect(snap.weightBreaking).toBe(0.5);
    expect(snap.allowedLanguages).toEqual(["en"]);
  });
});
