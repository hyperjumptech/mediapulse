import { initJobQueue } from "@nicnocquee/dataqueue";
import { env } from "@workspace/env/hermes-worker";
import type { JobPayloadMap } from "./job-payload-map";

let jobQueue: ReturnType<typeof initJobQueue<JobPayloadMap>> | null = null;

/**
 * Returns the singleton DataQueue instance. Throws if PG_DATAQUEUE_DATABASE is not set.
 *
 * @returns Initialized job queue for Hermes scheduler.
 */
export const getJobQueue = (): ReturnType<
  typeof initJobQueue<JobPayloadMap>
> => {
  if (!jobQueue) {
    const connectionString = env.PG_DATAQUEUE_DATABASE;
    if (!connectionString) {
      throw new Error(
        "PG_DATAQUEUE_DATABASE is required for Hermes scheduler. Set it in .env (e.g. same as DATABASE_URL with ?schema=dataqueue) and run pnpm run migrate-dataqueue.",
      );
    }
    jobQueue = initJobQueue<JobPayloadMap>({
      databaseConfig: {
        connectionString,
      },
      verbose: false,
    });
  }
  return jobQueue;
};
