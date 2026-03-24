import type { InvokeAgentJobPayload } from "@hermes/scheduler";

/**
 * DataQueue job payload map for Hermes. Keys are job types; values are payload shapes.
 * check_schedules: polls due schedules and enqueues invoke_agent jobs.
 * invoke_agent: one job per agent invocation; processor runs with configurable concurrency.
 */
export type JobPayloadMap = {
  check_schedules: {
    timestamp?: string;
  };
  execute_http_trigger: {
    httpTriggerExecutionId: string;
  };
  invoke_agent: InvokeAgentJobPayload;
};
