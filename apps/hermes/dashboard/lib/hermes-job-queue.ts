import type { InvokeAgentJobPayload } from "@hermes/scheduler";
import { initJobQueue } from "@nicnocquee/dataqueue";
import { env } from "@hermes/env";

type DashboardJobPayloadMap = {
  execute_http_trigger: {
    httpTriggerExecutionId: string;
  };
  /** Typed for queue control APIs; dashboard enqueues `execute_http_trigger` and manual `invoke_agent` runs. */
  invoke_agent: InvokeAgentJobPayload;
};

let queue: ReturnType<typeof initJobQueue<DashboardJobPayloadMap>> | null =
  null;

/**
 * Returns a singleton queue client used by dashboard API routes.
 */
export const getHermesJobQueue = (): ReturnType<
  typeof initJobQueue<DashboardJobPayloadMap>
> => {
  if (!queue) {
    const connectionString = env.PG_DATAQUEUE_DATABASE;
    if (!connectionString) {
      throw new Error(
        "PG_DATAQUEUE_DATABASE is required to enqueue DataQueue jobs (HTTP triggers and manual pipeline runs).",
      );
    }
    queue = initJobQueue<DashboardJobPayloadMap>({
      databaseConfig: { connectionString },
      verbose: false,
    });
  }
  return queue;
};
