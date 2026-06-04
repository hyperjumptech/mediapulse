/** @vitest-environment node */

import { describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {
    searchQuerySet: { findMany: vi.fn() },
    contentGenerationRun: { findMany: vi.fn() },
  },
}));

import { getSectionCoverageRollup } from "./section-coverage-rollup.js";

const makeDb = () => ({
  searchQuerySet: {
    findMany: vi.fn(),
  },
  contentGenerationRun: {
    findMany: vi.fn(),
  },
});

describe("getSectionCoverageRollup", () => {
  it("aggregates QA coverage and CG fill by contract version", async () => {
    const db = makeDb();
    db.searchQuerySet.findMany.mockResolvedValue([
      {
        strategySnapshot: {
          sectionCoverage: {
            contractVersion: "1",
            bySection: { industryPulse: { count: 4 } },
          },
        },
      },
      {
        strategySnapshot: {
          sectionCoverage: {
            contractVersion: "1",
            bySection: { industryPulse: { count: 2 } },
          },
        },
      },
    ]);
    db.contentGenerationRun.findMany.mockResolvedValue([
      {
        details: {
          sectionFill: {
            contractVersion: "1",
            bySection: { industryPulse: { citedBullets: 3 } },
          },
        },
      },
    ]);

    const rows = await getSectionCoverageRollup(
      { tickerId: "ticker-1", windowDays: 30 },
      db,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      contractVersion: "1",
      coverageRunCount: 2,
      fillRunCount: 1,
    });
    expect(rows[0]?.bySection.industryPulse).toEqual({
      avgCoverage: 3,
      avgFill: 3,
    });
  });

  it("groups runs without a contract under null version", async () => {
    const db = makeDb();
    db.searchQuerySet.findMany.mockResolvedValue([
      {
        strategySnapshot: {
          sectionCoverage: {
            bySection: { quickHits: { count: 1 } },
          },
        },
      },
    ]);
    db.contentGenerationRun.findMany.mockResolvedValue([]);

    const rows = await getSectionCoverageRollup(
      { tickerId: "ticker-1", windowDays: 7 },
      db,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.contractVersion).toBeNull();
    expect(rows[0]?.bySection.quickHits?.avgCoverage).toBe(1);
    expect(rows[0]?.bySection.quickHits?.avgFill).toBeNull();
  });
});
