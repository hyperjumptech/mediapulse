import { createMediapulseHermesDashboardRuntimeConfig } from "@mediapulse/hermes-dashboard";
import { env as hermesEnv } from "@hermes/env";

/**
 * Builds Mediapulse operator dashboard runtime config for Hermes-hosted routes.
 *
 * @returns Config wired from `@mediapulse/env` and the Hermes internal API key.
 */
export const getMediapulseHermesDashboardRuntimeConfig = () =>
  createMediapulseHermesDashboardRuntimeConfig(
    hermesEnv.HERMES_INTERNAL_API_KEY,
  );
