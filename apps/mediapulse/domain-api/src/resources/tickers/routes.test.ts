/**
 * Route wiring tests for tickers (custom action registration on the Hono app).
 */

/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mediapulse/database")>();
  return {
    ...actual,
    prisma: {
      ...actual.prisma,
      ticker: {
        ...actual.prisma.ticker,
        deleteMany: vi.fn(),
      },
    },
  };
});

import { prisma } from "@mediapulse/database";

import { tickersRoutes } from "./routes";
import {
  tickersResetAllConfirmToken,
  tickersTableV1CustomActions,
} from "./custom-actions";

describe("tickersRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers POST for the IDX import path declared on the dashboard manifest", async () => {
    // Setup
    const importIdx = tickersTableV1CustomActions[0];
    expect(importIdx).toBeDefined();

    // Act — empty body fails validation before DB; 404 would mean path drift vs manifest.
    const res = await tickersRoutes.request(
      `http://localhost${importIdx!.manifest.path}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    // Assert
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(400);
  });

  it("reset-all deletes every ticker when confirm token matches", async () => {
    vi.mocked(prisma.ticker.deleteMany).mockResolvedValue({ count: 1 });

    const res = await tickersRoutes.request("http://localhost/reset-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: tickersResetAllConfirmToken }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 1 });
    expect(prisma.ticker.deleteMany).toHaveBeenCalledWith({});
  });
});
