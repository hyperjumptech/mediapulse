/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { loadProcessedUrlsExecution } from "./processed-urls-execution";

const executionRow = {
  schedule: {
    pipeline: { domainIntegration: { integrationId: "integration-a" } },
  },
  agentJobExecutions: [{ agentId: "collector" }, { agentId: "crawler" }],
};

describe("loadProcessedUrlsExecution", () => {
  it("resolves the integration from the pipeline and lists the agents that ran", async () => {
    const findFirst = vi.fn().mockResolvedValue(executionRow);

    const execution = await loadProcessedUrlsExecution(
      "schedule-1",
      "execution-1",
      { findFirst } as never,
    );

    expect(execution).toEqual({
      integrationId: "integration-a",
      agentIds: ["collector", "crawler"],
    });
  });

  it("scopes the lookup to the schedule and asks for distinct agents", async () => {
    const findFirst = vi.fn().mockResolvedValue(executionRow);

    await loadProcessedUrlsExecution("schedule-1", "execution-1", {
      findFirst,
    } as never);

    const query = findFirst.mock.calls[0]?.[0];

    expect(query.where).toEqual({
      id: "execution-1",
      scheduleId: "schedule-1",
    });
    expect(query.select.agentJobExecutions).toEqual({
      select: { agentId: true },
      distinct: ["agentId"],
      orderBy: { agentId: "asc" },
    });
  });

  it("returns null when the execution does not belong to the schedule", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);

    const execution = await loadProcessedUrlsExecution(
      "schedule-1",
      "execution-9",
      { findFirst } as never,
    );

    expect(execution).toBeNull();
  });
});
