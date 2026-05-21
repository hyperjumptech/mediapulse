/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {
    dataSource: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@mediapulse/database";

import { getDataSourceHostCountsForTicker } from "./data-source-host-counts";

describe("getDataSourceHostCountsForTicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns hostname counts for stored data sources", async () => {
    // Setup
    vi.mocked(prisma.dataSource.findMany).mockResolvedValueOnce([
      { url: "https://www.reuters.com/a" },
      { url: "https://www.reuters.com/b" },
      { url: "https://example.com/c" },
    ] as never);

    // Act
    const hostCounts = await getDataSourceHostCountsForTicker("ticker-1");

    // Assert
    expect(hostCounts).toEqual({
      "www.reuters.com": 2,
      "example.com": 1,
    });
  });
});
