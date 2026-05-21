/** @vitest-environment node */

import { describe, expect, it, vi } from "vitest";

import { getRecentSourceFingerprints } from "./data-collection-fingerprints";

describe("getRecentSourceFingerprints", () => {
  it("returns title and head snippet capped at 600 chars", async () => {
    const now = new Date("2026-05-21T12:00:00.000Z");
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "ds-1",
        title: "Apple Q2 earnings beat",
        content: "x".repeat(800),
      },
    ]);

    const result = await getRecentSourceFingerprints(
      { tickerId: "ticker-1", windowDays: 7 },
      { dataSource: { findMany }, now },
    );

    expect(result).toEqual([
      {
        id: "ds-1",
        title: "Apple Q2 earnings beat",
        headSnippet: "x".repeat(600),
      },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tickerId: "ticker-1",
          createdAt: { gte: new Date("2026-05-14T12:00:00.000Z") },
        }),
        take: 200,
        orderBy: { createdAt: "desc" },
      }),
    );
  });
});
