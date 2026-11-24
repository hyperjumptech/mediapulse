import type {
  FailedIngestionJob,
  OrganonIngestionClient,
} from "@mediapulse/knowledge-graph";
import type { AgentDataApiClient } from "@workspace/agent-data-api-client";
import { ORGANON_INGESTION_RETRIES_MAX } from "@workspace/agent-data-api-contract";

import { chunked } from "./chunked.js";

export const MAX_SWEEP_PAGES = 3;

export type SweepResult = {
  failedJobs: number;
  failedSinceRunStarted: number;
  claimed: number;
  retried: number;
  notRetryable: number;
};

export type SweepOutcome = {
  result: SweepResult;
  failedSinceRunStarted: FailedIngestionJob[];
};

const failedAtOrAfter = (job: FailedIngestionJob, time: Date): boolean =>
  job.finishedAt !== null &&
  new Date(job.finishedAt).getTime() >= time.getTime();

export const sweepFailedJobs = async ({
  organon,
  dataApi,
  failedBefore,
}: {
  organon: Pick<OrganonIngestionClient, "listFailedJobs" | "retryJob">;
  dataApi: Pick<AgentDataApiClient, "organonIngestionRetries">;
  failedBefore: Date;
}): Promise<SweepOutcome> => {
  const failedJobs: FailedIngestionJob[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_SWEEP_PAGES; page += 1) {
    const listed = await organon.listFailedJobs(cursor ? { cursor } : {});
    failedJobs.push(...listed.jobs);
    cursor = listed.nextCursor;
    if (!cursor) {
      break;
    }
  }

  const failedSinceRunStarted = failedJobs.filter((job) =>
    failedAtOrAfter(job, failedBefore),
  );
  const retryableJobIds = failedJobs
    .filter((job) => !failedAtOrAfter(job, failedBefore))
    .map((job) => job.id);

  const claimedJobIds: string[] = [];
  for (const organonJobIds of chunked(
    retryableJobIds,
    ORGANON_INGESTION_RETRIES_MAX,
  )) {
    const claim = await dataApi.organonIngestionRetries.create({
      organonJobIds,
    });
    claimedJobIds.push(...claim.claimedJobIds);
  }

  let retried = 0;
  let notRetryable = 0;
  for (const jobId of claimedJobIds) {
    const outcome = await organon.retryJob(jobId);
    if (outcome === "retried") {
      retried += 1;
    } else {
      notRetryable += 1;
    }
  }

  return {
    result: {
      failedJobs: failedJobs.length,
      failedSinceRunStarted: failedSinceRunStarted.length,
      claimed: claimedJobIds.length,
      retried,
      notRetryable,
    },
    failedSinceRunStarted,
  };
};
