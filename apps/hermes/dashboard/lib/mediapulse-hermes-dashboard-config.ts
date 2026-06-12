import type { MediapulseHermesDashboardRuntimeConfig } from "@mediapulse/hermes-dashboard";
import { env as hermesEnv } from "@hermes/env";
import { env as mediapulseEnv } from "@mediapulse/env";

/**
 * Builds Mediapulse operator dashboard runtime config for Hermes-hosted routes.
 *
 * @returns Config wired from `@mediapulse/env` and the Hermes internal API key.
 */
export const getMediapulseHermesDashboardRuntimeConfig =
  (): MediapulseHermesDashboardRuntimeConfig => ({
    agentDataApiUrl: mediapulseEnv.AGENT_DATA_API_URL ?? "",
    agentAuthApiUrl: mediapulseEnv.AGENT_AUTH_API_URL,
    internalApiKey: hermesEnv.HERMES_INTERNAL_API_KEY,
    cgaDiagnosticsEnabled:
      mediapulseEnv.MEDIAPULSE_CGA_DIAGNOSTICS_ENABLED === "true",
  });
