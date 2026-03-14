import type { InvokeAgentStepPayload } from "@workspace/hermes-scheduler";

/**
 * DataQueue job payload map for Hermes. check_schedules polls due runs;
 * invoke_agent_step runs one agent invocation per expanded input set.
 */
export type JobPayloadMap = {
  check_schedules: {
    timestamp?: string;
  };
  invoke_agent_step: InvokeAgentStepPayload;
};
