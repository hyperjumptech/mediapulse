/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";

import { getSectionCoverageRollupForTicker } from "./section-coverage-rollup";

const getMock = vi.fn();

vi.mock("./agent-data-api-client", () => ({
  getDashboardAgentDataApiClient: () => ({
    sectionCoverageRollup: { get: getMock },
  }),
}));

describe("getSectionCoverageRollupForTicker", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns byVersion rows from the agent-data-api client", async () => {
    getMock.mockResolvedValue({
      byVersion: [
        {
          contractVersion: "2",
          coverageRunCount: 3,
          fillRunCount: 2,
          bySection: {},
        },
      ],
    });

    const rows = await getSectionCoverageRollupForTicker("ticker-1", 7);

    expect(getMock).toHaveBeenCalledWith({
      tickerId: "ticker-1",
      windowDays: 7,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.contractVersion).toBe("2");
  });
});
