/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  getProcessedUrlsForApi,
  type ProcessedUrlsApiDependencies,
} from "@/lib/processed-urls-api";

const query = {
  scheduleId: "schedule-1",
  executionId: "execution-1",
  page: 1,
  pageSize: 50,
  status: "dropped",
};

describe("getProcessedUrlsForApi", () => {
  it("asks the execution's integration for its processed URLs", async () => {
    const listResponse = { items: [], total: 0, page: 1, pageSize: 50 };
    const dependencies: ProcessedUrlsApiDependencies = {
      loadExecution: vi
        .fn()
        .mockResolvedValue({ integrationId: "acme", agentIds: ["collector"] }),
      fetchProcessedUrls: vi.fn().mockResolvedValue(listResponse),
    };

    const result = await getProcessedUrlsForApi(query, dependencies);

    expect(dependencies.loadExecution).toHaveBeenCalledWith(
      "schedule-1",
      "execution-1",
    );
    expect(dependencies.fetchProcessedUrls).toHaveBeenCalledWith({
      integrationId: "acme",
      scheduleExecutionId: "execution-1",
      page: 1,
      pageSize: 50,
      status: "dropped",
    });
    expect(result).toBe(listResponse);
  });

  it("returns null for an execution of another schedule", async () => {
    const dependencies: ProcessedUrlsApiDependencies = {
      loadExecution: vi.fn().mockResolvedValue(null),
      fetchProcessedUrls: vi.fn(),
    };

    const result = await getProcessedUrlsForApi(query, dependencies);

    expect(result).toBeNull();
    expect(dependencies.fetchProcessedUrls).not.toHaveBeenCalled();
  });
});
