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
} from "./scheduler";

const httpClient: InvokeAgentHttpClient = {
  post: (url, options) =>
    got.post(url, {
      json: options.json,
      headers: options.headers,
      timeout: options.timeout,
    }),
};

/**
 * DataQueue job handlers for Hermes. check_schedules polls the DB for due schedules and runs them.
 */
export const jobHandlers: JobHandlers<JobPayloadMap> = {
  check_schedules: async () => {
    const schedules = await getDueSchedules(prisma);
    for (const schedule of schedules) {
      try {
        await executeSchedule(schedule, {
          db: prisma,
          httpClient,
          logger,
          authToken: env.AGENT_API_KEY,
          defaultTimeoutMs: 300_000,
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
