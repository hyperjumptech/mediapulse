/**
 * Runtime configuration for Mediapulse operator surfaces hosted in the Hermes dashboard.
 */
export type MediapulseHermesDashboardRuntimeConfig = {
  agentDataApiUrl: string;
  agentAuthApiUrl: string;
  internalApiKey: string;
  cgaDiagnosticsEnabled: boolean;
};
