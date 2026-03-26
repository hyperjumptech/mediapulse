import { initJobQueue } from "@nicnocquee/dataqueue";
import { env } from "@hermes/env";

type DashboardJobPayloadMap = {
  execute_http_trigger: {
    httpTriggerExecutionId: string;
  };
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
        "PG_DATAQUEUE_DATABASE is required to enqueue HTTP trigger runs.",
      );
    }
    queue = initJobQueue<DashboardJobPayloadMap>({
      databaseConfig: { connectionString },
      verbose: false,
    });
  }
  return queue;
};
