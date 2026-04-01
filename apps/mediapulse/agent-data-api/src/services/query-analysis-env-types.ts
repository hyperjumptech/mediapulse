import type { env } from "@mediapulse/env";

/** Subset of `@mediapulse/env` used by query-analysis GET handlers. */
export type MediapulseEnvLike = Pick<
  typeof env,
  | "QUERY_ANALYSIS_QUERY_COUNT"
  | "QUERY_ANALYSIS_ALLOWED_LANGUAGES"
  | "QUERY_ANALYSIS_MIN_DETERMINISTIC_COUNT"
  | "QUERY_ANALYSIS_WEIGHT_BREAKING"
  | "QUERY_ANALYSIS_WEIGHT_KG_CHANGE"
  | "QUERY_ANALYSIS_WEIGHT_FUNDAMENTAL"
  | "QUERY_ANALYSIS_MODEL"
  | "QUERY_ANALYSIS_MAX_TOKENS"
>;
