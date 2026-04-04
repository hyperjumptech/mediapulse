/** @vitest-environment node */
import { describe, it, expect, vi, afterEach } from "vitest";
import { createRegistrationHandler } from "./route.post.config";
import { prisma } from "@mediapulse/database";

vi.mock("@mediapulse/database", () => ({
  prisma: {
    ticker: { findUnique: vi.fn() },
    mediapulseUser: { upsert: vi.fn() },
    userTicker: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));

describe("registration route handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("returns success for valid registration", async () => {
    // Setup
    vi.mocked(prisma.ticker.findUnique).mockResolvedValue({
      id: "ticker-1",
      symbol: "BBCA",
    } as never);
    vi.mocked(prisma.mediapulseUser.upsert).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
    } as never);
    vi.mocked(prisma.userTicker.upsert).mockResolvedValue({
      id: "ut-1",
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn) => await fn(prisma),
    );

    const handler = createRegistrationHandler({ prisma: prisma as never });

    // Act
    const result = await handler({
      body: {
        email: "test@example.com",
        name: "Test User",
        tickerSymbol: "BBCA",
      },
      params: undefined,
      headers: new Headers(),
      user: undefined,
      searchParams: undefined,
    });

    // Assert
    expect(result.status).toBe(true);
    if (result.status) {
      expect(result.data.message).toContain("Successfully registered");
    }
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("returns 404 if ticker not found", async () => {
    // Setup
    vi.mocked(prisma.ticker.findUnique).mockResolvedValue(null);
    const handler = createRegistrationHandler({ prisma: prisma as never });

    // Act
    const result = await handler({
      body: {
        email: "test@example.com",
        tickerSymbol: "UNKNOWN",
      },
      params: undefined,
      headers: new Headers(),
      user: undefined,
      searchParams: undefined,
    });

    // Assert
    expect(result.status).toBe(false);
    if (!result.status) {
      expect((result as { message: string }).message).toBe("Ticker not found");
    }
  });

  it("returns 500 if database fails during transaction", async () => {
    // Setup
    vi.mocked(prisma.ticker.findUnique).mockResolvedValue({
      id: "ticker-1",
      symbol: "BBCA",
    } as never);
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Error("Database error"),
    );
    const handler = createRegistrationHandler({ prisma: prisma as never });

    // Act
    const result = await handler({
      body: {
        email: "test@example.com",
        tickerSymbol: "BBCA",
      },
      params: undefined,
      headers: new Headers(),
      user: undefined,
      searchParams: undefined,
    });

    // Assert
    expect(result.status).toBe(false);
    if (!result.status) {
      expect((result as { message: string }).message).toBe(
        "Internal server error during registration",
      );
    }
  });
});
