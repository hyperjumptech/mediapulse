import got from "got";
import { prisma } from "@workspace/database";
import { env } from "@workspace/env/hermes-worker";
import { logger } from "@workspace/logger";
import type { JobHandlers } from "@nicnocquee/dataqueue";
import type { JobPayloadMap } from "./job-payload-map";
import { createAgentTokenClient } from "@workspace/agent-auth-client";
import {
  executeSchedule,
  getDueSchedules,
  type InvokeAgentHttpClient,
} from "@workspace/hermes-scheduler";

const httpClient: InvokeAgentHttpClient = {
  post: (url, options) =>
    got.post(url, {
      json: options.json,
      headers: options.headers,
      timeout: options.timeout,
    }),
};

if (!env.AGENT_AUTH_API_URL || !env.AGENT_API_KEY) {
  throw new Error(
    "AGENT_AUTH_API_URL and AGENT_API_KEY are required for hermes-worker (JWT-only agent invocation)",
  );
}

/** JWT-only: worker mints short-lived tokens from auth API; never sends raw API key to agents. */
const tokenClient = createAgentTokenClient({
  authApiUrl: env.AGENT_AUTH_API_URL,
  credential: env.AGENT_API_KEY,
});

/**
 * Returns a short-lived JWT from the auth API for agent invocation.
 */
async function getAuthToken(): Promise<string> {
  return tokenClient.getToken();
}

/**
 * DataQueue job handlers for Hermes. check_schedules polls the DB for due schedules and runs them.
 */
export const jobHandlers: JobHandlers<JobPayloadMap> = {
  check_schedules: async () => {
    const authToken = await getAuthToken();
    const schedules = await getDueSchedules(prisma);
    for (const schedule of schedules) {
      try {
        await executeSchedule(schedule, {
          db: prisma,
          httpClient,
          logger,
          authToken,
          defaultTimeoutMs: 300_000,
          requireHttpsAgentEndpoints:
            env.REQUIRE_HTTPS_AGENT_ENDPOINTS === "true",
        });
      } catch (err) {
        logger.error(
          { err, scheduleId: schedule.id },
          "executeSchedule failed for schedule",
        );
      }
    }
  },
};
