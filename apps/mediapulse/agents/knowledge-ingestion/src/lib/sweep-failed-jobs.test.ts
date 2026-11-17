import { describe, expect, it, vi } from "vitest";

import { MAX_SWEEP_PAGES, sweepFailedJobs } from "./sweep-failed-jobs.js";

const page = (ids: string[], nextCursor: string | null) => ({
  jobs: ids.map((id) => ({
    id,
    error: "Provider timed out",
    canonicalUrl: null,
    finishedAt: null,
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
    });

    expect(result).toEqual({
      failedJobs: 0,
      claimed: 0,
      retried: 0,
      notRetryable: 0,
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
    });

    expect(organon.listFailedJobs).toHaveBeenCalledTimes(MAX_SWEEP_PAGES);
    expect(organon.listFailedJobs).toHaveBeenNthCalledWith(2, {
      cursor: "next",
    });
    expect(result.failedJobs).toBe(MAX_SWEEP_PAGES);
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
    });

    const batchSizes = dataApi.organonIngestionRetries.create.mock.calls.map(
      (call) => (call[0] as { organonJobIds: string[] }).organonJobIds.length,
    );
    expect(batchSizes).toEqual([100, 50]);
    expect(organon.retryJob.mock.calls).toEqual([["job-3"], ["job-120"]]);
    expect(result).toEqual({
      failedJobs: 150,
      claimed: 2,
      retried: 1,
      notRetryable: 1,
    });
  });
});
