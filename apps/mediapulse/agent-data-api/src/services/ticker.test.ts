/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {
    ticker: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@mediapulse/database";

import { getTickerForAgent } from "./ticker";

describe("getTickerForAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the ticker row is missing", async () => {
    // Setup
    vi.mocked(prisma.ticker.findUnique).mockResolvedValueOnce(null);

    // Act
    const result = await getTickerForAgent(
      "11111111-1111-4111-a111-111111111111",
    );

    // Assert
    expect(result).toBeNull();
  });

  it("returns symbol, name, and metadata aliases", async () => {
    // Setup
    vi.mocked(prisma.ticker.findUnique).mockResolvedValueOnce({
      id: "11111111-1111-4111-a111-111111111111",
      symbol: "BBCA",
      name: "Bank Central Asia Tbk",
      metadata: {
        aliases: ["BCA", "Bank Central Asia", "BCA"],
      },
    } as never);

    // Act
    const result = await getTickerForAgent(
      "11111111-1111-4111-a111-111111111111",
    );

    // Assert
    expect(result).toEqual({
      id: "11111111-1111-4111-a111-111111111111",
      symbol: "BBCA",
      name: "Bank Central Asia Tbk",
      aliases: ["BCA", "Bank Central Asia"],
    });
  });
});
