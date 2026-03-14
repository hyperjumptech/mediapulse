import got from "got";
import { AgentJobExecutionStatus, prisma } from "@workspace/database";
import { env } from "@workspace/env";
import { logger } from "@workspace/logger";
import type { JobHandlers } from "@nicnocquee/dataqueue";
import type { JobPayloadMap } from "./job-payload-map";
import {
  executeSchedule,
  getDueSchedules,
  invokeAgent,
  type InvokeAgentHttpClient,
} from "@workspace/hermes-scheduler";
import { getJobQueue } from "./queue";

const httpClient: InvokeAgentHttpClient = {
  post: (url, options) =>
    got.post(url, {
      json: options.json,
      headers: options.headers,
      timeout: options.timeout,
    }),
};

/**
 * DataQueue job handlers for Hermes. check_schedules enqueues one invoke_agent_step
 * per expanded input set; invoke_agent_step runs a single agent invocation (idempotent).
 */
export const jobHandlers: JobHandlers<JobPayloadMap> = {
  check_schedules: async () => {
    const queue = getJobQueue();
    const schedules = await getDueSchedules(prisma);
    for (const schedule of schedules) {
      try {
        await executeSchedule(schedule, {
          db: prisma,
          httpClient,
          logger,
          authToken: env.AGENT_API_KEY,
          defaultTimeoutMs: 300_000,
          enqueueAgentJob: (payload) =>
            queue
              .addJob({
                jobType: "invoke_agent_step",
                payload,
                timeoutMs: payload.timeoutMs,
              })
              .then(() => {}),
        });
      } catch (err) {
        logger.error(
          { err, scheduleId: schedule.id },
          "executeSchedule failed for schedule",
        );
      }
    }
  },

  invoke_agent_step: async (payload) => {
    const execution = await prisma.agentJobExecution.findUnique({
      where: { jobId: payload.jobId },
    });
    if (!execution) {
      logger.warn(
        {
          jobId: payload.jobId,
          scheduleExecutionId: payload.scheduleExecutionId,
        },
        "AgentJobExecution not found for invoke_agent_step",
      );
      return;
    }
    if (
      execution.status === AgentJobExecutionStatus.running ||
      execution.status === AgentJobExecutionStatus.completed
    ) {
      return;
    }
    try {
      await invokeAgent(
        payload.endpoint,
        payload.body,
        {
          jobId: payload.jobId,
          executionId: payload.executionId,
          authToken: env.AGENT_API_KEY,
          timeoutMs: payload.timeoutMs,
        },
        httpClient,
      );
      await prisma.agentJobExecution.update({
        where: { jobId: payload.jobId },
        data: {
          status: AgentJobExecutionStatus.running,
          startedAt: new Date(),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.agentJobExecution
        .update({
          where: { jobId: payload.jobId },
          data: {
            status: AgentJobExecutionStatus.failed,
            error: { message, retryable: true },
            completedAt: new Date(),
          },
        })
        .catch(() => {});
      throw err;
    }
  },
};
