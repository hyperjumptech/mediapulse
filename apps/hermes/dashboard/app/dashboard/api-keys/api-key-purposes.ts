import { z } from "zod";

/** Allowed API key purpose values stored on `APIKey.purpose` and accepted by agent-auth `POST /api/token` (subset). */
export const API_KEY_PURPOSE_VALUES = [
  "general",
  "scheduler",
  "run_pipeline",
  "domain_integration",
] as const;

export type ApiKeyPurpose = (typeof API_KEY_PURPOSE_VALUES)[number];

export const apiKeyPurposeSchema = z.enum(API_KEY_PURPOSE_VALUES);

/** Human-readable labels for dashboard forms and tables. */
export const API_KEY_PURPOSE_LABELS: Record<ApiKeyPurpose, string> = {
  general: "General",
  scheduler: "Scheduler (legacy)",
  run_pipeline: "Run pipeline",
  domain_integration: "Domain integration (Mediapulse / agents)",
};
