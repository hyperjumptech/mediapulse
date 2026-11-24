import { describe, expect, it, vi } from "vitest";

import { MAX_SWEEP_PAGES, sweepFailedJobs } from "./sweep-failed-jobs.js";

const RUN_STARTED_AT = new Date("2026-11-24T20:06:41.000Z");

const page = (
  ids: string[],
  nextCursor: string | null,
  finishedAt: string | null = null,
) => ({
  jobs: ids.map((id) => ({
    id,
    error: "Provider timed out",
    canonicalUrl: null,
    finishedAt,
  })),
  nextCursor,
});

describe("sweepFailedJobs", () => {
  it("does nothing when no job failed", async () => {
    const organon = {
      listFailedJobs: vi.fn().mockResolvedValue(page([], null)),
      retryJob: vi.fn(),
    };
    const dataApi = { organonIngestionRetries: { create: vi.fn() } };

    const result = await sweepFailedJobs({
      organon,
      dataApi: dataApi as never,
      failedBefore: RUN_STARTED_AT,
    });

    expect(result).toEqual({
      result: {
        failedJobs: 0,
        failedSinceRunStarted: 0,
        claimed: 0,
        retried: 0,
        notRetryable: 0,
      },
      failedSinceRunStarted: [],
    });
    expect(dataApi.organonIngestionRetries.create).not.toHaveBeenCalled();
  });

  it("reads at most a few pages of failed jobs", async () => {
    const organon = {
      listFailedJobs: vi
        .fn()
        .mockImplementation(async ({ cursor }: { cursor?: string }) =>
          page([`job-${cursor ?? "first"}`], `${cursor ?? ""}next`),
        ),
      retryJob: vi.fn(),
    };
    const dataApi = {
      organonIngestionRetries: {
        create: vi.fn().mockResolvedValue({ claimedJobIds: [] }),
      },
    };

    const result = await sweepFailedJobs({
      organon,
      dataApi: dataApi as never,
      failedBefore: RUN_STARTED_AT,
    });

    expect(organon.listFailedJobs).toHaveBeenCalledTimes(MAX_SWEEP_PAGES);
    expect(organon.listFailedJobs).toHaveBeenNthCalledWith(2, {
      cursor: "next",
    });
    expect(result.result.failedJobs).toBe(MAX_SWEEP_PAGES);
  });

  it("claims in batches and retries only the claimed jobs", async () => {
    const ids = Array.from({ length: 150 }, (_, index) => `job-${index}`);
    const organon = {
      listFailedJobs: vi.fn().mockResolvedValue(page(ids, null)),
      retryJob: vi
        .fn()
        .mockResolvedValueOnce("retried")
        .mockResolvedValueOnce("not-retryable"),
    };
    const dataApi = {
      organonIngestionRetries: {
        create: vi
          .fn()
          .mockResolvedValueOnce({ claimedJobIds: ["job-3"] })
          .mockResolvedValueOnce({ claimedJobIds: ["job-120"] }),
      },
    };

    const result = await sweepFailedJobs({
      organon,
      dataApi: dataApi as never,
      failedBefore: RUN_STARTED_AT,
    });

    const batchSizes = dataApi.organonIngestionRetries.create.mock.calls.map(
      (call) => (call[0] as { organonJobIds: string[] }).organonJobIds.length,
    );
    expect(batchSizes).toEqual([100, 50]);
    expect(organon.retryJob.mock.calls).toEqual([["job-3"], ["job-120"]]);
    expect(result.result).toEqual({
      failedJobs: 150,
      failedSinceRunStarted: 0,
      claimed: 2,
      retried: 1,
      notRetryable: 1,
    });
  });

  it("leaves jobs that failed after the run started for the next sweep", async () => {
    const earlier = page(["job-last-night"], null, "2026-11-23T20:07:21.000Z");
    const sinceStart = page(["job-tonight"], null, "2026-11-24T20:07:18.000Z");
    const organon = {
      listFailedJobs: vi.fn().mockResolvedValue({
        jobs: [...sinceStart.jobs, ...earlier.jobs],
        nextCursor: null,
      }),
      retryJob: vi.fn().mockResolvedValue("retried"),
    };
    const dataApi = {
      organonIngestionRetries: {
        create: vi
          .fn()
          .mockResolvedValue({ claimedJobIds: ["job-last-night"] }),
      },
    };

    const result = await sweepFailedJobs({
      organon,
      dataApi: dataApi as never,
      failedBefore: RUN_STARTED_AT,
    });

    expect(dataApi.organonIngestionRetries.create).toHaveBeenCalledWith({
      organonJobIds: ["job-last-night"],
    });
    expect(organon.retryJob.mock.calls).toEqual([["job-last-night"]]);
    expect(result.result).toEqual({
      failedJobs: 2,
      failedSinceRunStarted: 1,
      claimed: 1,
      retried: 1,
      notRetryable: 0,
    });
    expect(result.failedSinceRunStarted.map((job) => job.id)).toEqual([
      "job-tonight",
    ]);
  });

  it("retries a failed job with no finish time, as before", async () => {
    const organon = {
      listFailedJobs: vi.fn().mockResolvedValue(page(["job-unknown"], null)),
      retryJob: vi.fn().mockResolvedValue("retried"),
    };
    const dataApi = {
      organonIngestionRetries: {
        create: vi.fn().mockResolvedValue({ claimedJobIds: ["job-unknown"] }),
      },
    };

    const result = await sweepFailedJobs({
      organon,
      dataApi: dataApi as never,
      failedBefore: RUN_STARTED_AT,
    });

    expect(organon.retryJob).toHaveBeenCalledWith("job-unknown");
    expect(result.failedSinceRunStarted).toEqual([]);
  });
});
