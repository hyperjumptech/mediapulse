/** @vitest-environment node */

import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type {
  DataApiGetFn,
  DataApiPostFn,
} from "@workspace/agent-data-api-client";
import { env } from "@hermes/env";

/**
 * Creates a pre-configured agent-data-api SDK client for the Hermes dashboard.
 *
 * @param options - Optional overrides for the base URL, token, and transport functions.
 * @param options.baseUrl - Override for the agent-data-api base URL. Defaults to `env.AGENT_DATA_API_URL`.
 * @param options.token - Override for the Bearer token. Defaults to `env.HERMES_INTERNAL_API_KEY`.
 * @param options.getFn - Custom GET function for dependency injection in tests.
 * @param options.postFn - Custom POST function for dependency injection in tests.
 * @returns A typed SDK client instance for the agent-data-api.
 */
export const createDashboardAgentDataApiClient = (options?: {
  baseUrl?: string;
  token?: string;
  getFn?: DataApiGetFn;
  postFn?: DataApiPostFn;
}) =>
  createAgentDataApiClient({
    baseUrl: options?.baseUrl ?? env.AGENT_DATA_API_URL ?? "",
    token: options?.token ?? env.HERMES_INTERNAL_API_KEY,
    getFn: options?.getFn,
    postFn: options?.postFn,
  });

/** Cached singleton SDK client instance for the Hermes dashboard. */
let dashboardClient: ReturnType<
  typeof createDashboardAgentDataApiClient
> | null = null;

/**
 * Returns a singleton agent-data-api SDK client for the Hermes dashboard.
 * Creates the client on first call and caches it for subsequent calls.
 *
 * @returns A typed SDK client instance for the agent-data-api.
 */
export const getDashboardAgentDataApiClient = () => {
  if (!dashboardClient) {
    dashboardClient = createDashboardAgentDataApiClient();
  }
  return dashboardClient;
};
