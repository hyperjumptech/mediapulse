import got from "got";
import { prisma } from "@workspace/database";
import { env } from "@workspace/env/hermes-worker";
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

/** Short-lived tokens only: worker gets JWTs from auth API; no raw API key sent to agents. */
const tokenClient =
  env.AGENT_AUTH_API_URL && env.AGENT_API_KEY
    ? createAgentTokenClient({
        authApiUrl: env.AGENT_AUTH_API_URL,
        credential: env.AGENT_API_KEY,
      })
    : null;

/**
 * Returns a short-lived token from the auth API for agent invocation. Requires AGENT_AUTH_API_URL, AGENT_API_KEY, and agent-auth-api to have AGENT_AUTH_JWT_SECRET set.
 */
async function getAuthToken(): Promise<string | undefined> {
  if (!tokenClient) {
    return undefined;
  }
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
