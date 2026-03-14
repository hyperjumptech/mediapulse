import got from "got";
import { prisma } from "@workspace/database";
import { env } from "@workspace/env";
import { logger } from "@workspace/logger";
import type { JobHandlers } from "@nicnocquee/dataqueue";
import type { JobPayloadMap } from "./job-payload-map";
import {
  executeSchedule,
  getDueSchedules,
  type InvokeAgentHttpClient,
} from "@workspace/hermes-scheduler";
import { createAgentTokenClient } from "./agent-token-client";

const httpClient: InvokeAgentHttpClient = {
  post: (url, options) =>
    got.post(url, {
      json: options.json,
      headers: options.headers,
      timeout: options.timeout,
    }),
};

/** When set, use short-lived tokens from auth API instead of raw AGENT_API_KEY. */
const tokenClient =
  env.AGENT_AUTH_API_URL && env.AGENT_API_KEY
    ? createAgentTokenClient({
        authApiUrl: env.AGENT_AUTH_API_URL,
        credential: env.AGENT_API_KEY,
      })
    : null;

/**
 * Resolves the auth token to use for agent invocation: short-lived JWT when token client is configured, else raw API key.
 */
async function getAuthToken(): Promise<string | undefined> {
  if (tokenClient) {
    return tokenClient.getToken();
  }
  return env.AGENT_API_KEY;
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
