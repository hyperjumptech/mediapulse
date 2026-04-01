import type { QueryAnalysisConfigSnapshot } from "@workspace/agent-data-api-contract";

import type { MediapulseEnvLike } from "./query-analysis-env-types.js";

/**
 * Parses `QUERY_ANALYSIS_ALLOWED_LANGUAGES` JSON (array of strings); falls back to `["en"]` when invalid.
 *
 * @param raw - Raw env string or undefined.
 * @returns Non-empty language codes list.
 */
export const parseAllowedLanguages = (raw: string | undefined): string[] => {
  if (raw === undefined || raw.trim() === "") {
    return ["en"];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some((x) => typeof x !== "string")) {
      return ["en"];
    }
    return parsed.length > 0 ? parsed : ["en"];
  } catch {
    return ["en"];
  }
};

/**
 * Builds the global config snapshot returned on GET query-analysis (FR5).
 *
 * @param envLike - Injected `@mediapulse/env` subset for tests.
 * @returns Typed snapshot for the contract response.
 */
export const buildQueryAnalysisConfigSnapshot = (
  envLike: MediapulseEnvLike,
): QueryAnalysisConfigSnapshot => {
  const maxTokens = envLike.QUERY_ANALYSIS_MAX_TOKENS ?? 1000;
  return {
    queryCount: envLike.QUERY_ANALYSIS_QUERY_COUNT ?? 10,
    allowedLanguages: parseAllowedLanguages(
      envLike.QUERY_ANALYSIS_ALLOWED_LANGUAGES,
    ),
    minDeterministicCount: envLike.QUERY_ANALYSIS_MIN_DETERMINISTIC_COUNT ?? 3,
    weightBreaking: envLike.QUERY_ANALYSIS_WEIGHT_BREAKING ?? 0.5,
    weightKgChange: envLike.QUERY_ANALYSIS_WEIGHT_KG_CHANGE ?? 0.3,
    weightFundamental: envLike.QUERY_ANALYSIS_WEIGHT_FUNDAMENTAL ?? 0.2,
    model: envLike.QUERY_ANALYSIS_MODEL,
    maxTokens,
  };
};
