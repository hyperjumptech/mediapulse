/** @vitest-environment node */

import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { getSectionCoverageRollupHandler } from "./section-coverage-rollup.js";

vi.mock("../services/section-coverage-rollup.js", () => ({
  getSectionCoverageRollup: vi.fn(),
}));

import { getSectionCoverageRollup } from "../services/section-coverage-rollup.js";

describe("getSectionCoverageRollupHandler", () => {
  it("returns rollup rows for a valid ticker query", async () => {
    vi.mocked(getSectionCoverageRollup).mockResolvedValue([
      {
        contractVersion: "3",
        coverageRunCount: 1,
        fillRunCount: 0,
        bySection: {},
      },
    ]);

    const app = new Hono();
    app.get("/", getSectionCoverageRollupHandler);

    const response = await app.request(
      "/?tickerId=ticker-1&windowDays=14",
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { byVersion: unknown[] };
    expect(body.byVersion).toHaveLength(1);
    expect(getSectionCoverageRollup).toHaveBeenCalledWith({
      tickerId: "ticker-1",
      windowDays: 14,
    });
  });
});
