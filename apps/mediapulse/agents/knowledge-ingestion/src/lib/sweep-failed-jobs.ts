import type { OrganonIngestionClient } from "@mediapulse/knowledge-graph";
import type { AgentDataApiClient } from "@workspace/agent-data-api-client";
import { ORGANON_INGESTION_RETRIES_MAX } from "@workspace/agent-data-api-contract";

import { chunked } from "./chunked.js";

export const MAX_SWEEP_PAGES = 3;

export type SweepResult = {
  failedJobs: number;
  claimed: number;
  retried: number;
  notRetryable: number;
};

export const sweepFailedJobs = async ({
  organon,
  dataApi,
}: {
  organon: Pick<OrganonIngestionClient, "listFailedJobs" | "retryJob">;
  dataApi: Pick<AgentDataApiClient, "organonIngestionRetries">;
}): Promise<SweepResult> => {
  const failedJobIds: string[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_SWEEP_PAGES; page += 1) {
    const listed = await organon.listFailedJobs(cursor ? { cursor } : {});
    failedJobIds.push(...listed.jobs.map((job) => job.id));
    cursor = listed.nextCursor;
    if (!cursor) {
      break;
    }
  }

  const claimedJobIds: string[] = [];
  for (const organonJobIds of chunked(
    failedJobIds,
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
    failedJobs: failedJobIds.length,
    claimed: claimedJobIds.length,
    retried,
    notRetryable,
  };
};
