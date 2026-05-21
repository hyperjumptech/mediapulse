/** @vitest-environment node */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";

vi.mock("@mediapulse/database", () => ({
  prisma: {
    dataSource: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../services/data-collection-fingerprints.js", () => ({
  getRecentSourceFingerprints: vi.fn(),
}));

import { getRecentSourceFingerprints } from "../services/data-collection-fingerprints.js";
import { getDataCollectionRecentSourceFingerprints } from "./data-collection-recent-source-fingerprints";

describe("getDataCollectionRecentSourceFingerprints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns fingerprints from the service", async () => {
    vi.mocked(getRecentSourceFingerprints).mockResolvedValue([
      {
        id: "11111111-1111-4111-a111-111111111111",
        title: "Apple Q2 earnings beat",
        headSnippet: "Apple reported strong Q2 earnings.",
      },
    ]);

    const app = new Hono();
    app.get("/", getDataCollectionRecentSourceFingerprints);

    const response = await app.request("/?tickerId=ticker-1&windowDays=7", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      fingerprints: [
        {
          id: "11111111-1111-4111-a111-111111111111",
          title: "Apple Q2 earnings beat",
          headSnippet: "Apple reported strong Q2 earnings.",
        },
      ],
    });
  });
});
