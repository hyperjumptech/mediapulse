/** @vitest-environment node */

import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type {
  DataApiGetFn,
  DataApiPostFn,
} from "@workspace/agent-data-api-client";

import type { MediapulseHermesDashboardRuntimeConfig } from "../config";

/**
 * Creates a pre-configured agent-data-api SDK client for Mediapulse operator pages.
 *
 * @param config - Runtime URLs and Hermes internal API key for agent-data-api auth.
 * @param options - Optional transport overrides for tests.
 * @returns Typed SDK client for agent-data-api.
 */
export const createMediapulseAgentDataApiClient = (
  config: Pick<
    MediapulseHermesDashboardRuntimeConfig,
    "agentDataApiUrl" | "internalApiKey"
  >,
  options?: {
    getFn?: DataApiGetFn;
    postFn?: DataApiPostFn;
  },
) =>
  createAgentDataApiClient({
    baseUrl: config.agentDataApiUrl,
    token: config.internalApiKey,
    getFn: options?.getFn,
    postFn: options?.postFn,
  });
