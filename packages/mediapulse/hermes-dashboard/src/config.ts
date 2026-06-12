import { env } from "@mediapulse/env";

/**
 * Runtime configuration for Mediapulse operator surfaces hosted in the Hermes dashboard.
 */
export type MediapulseHermesDashboardRuntimeConfig = {
  agentDataApiUrl: string;
  internalApiKey: string;
  cgaDiagnosticsEnabled: boolean;
};

/**
 * Builds runtime config from Mediapulse env and the Hermes internal API key.
 *
 * @param internalApiKey - Hermes `HERMES_INTERNAL_API_KEY` used to call agent-data-api.
 * @returns Config for Mediapulse dashboard extension modules.
 */
export const createMediapulseHermesDashboardRuntimeConfig = (
  internalApiKey: string,
): MediapulseHermesDashboardRuntimeConfig => ({
  agentDataApiUrl: env.AGENT_DATA_API_URL ?? "",
  internalApiKey,
  cgaDiagnosticsEnabled: env.MEDIAPULSE_CGA_DIAGNOSTICS_ENABLED === "true",
});
