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
    if (!env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required to enqueue HTTP trigger runs.");
    }
    queue = initJobQueue<DashboardJobPayloadMap>({
      databaseConfig: { connectionString: env.DATABASE_URL },
      verbose: false,
    });
  }
  return queue;
};
