/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Row shape for `userTicker.findMany({ include: { user: true } })` (Prisma 7 does not export `GetPayload` here).
 */
type UserTickerWithUserRow = {
  id: string;
  userId: string;
  tickerId: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    email: string;
    name: string | null;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
};

vi.mock("@mediapulse/database", () => ({
  prisma: {
    newsletter: { findFirst: vi.fn() },
    userTicker: { findMany: vi.fn() },
    newsletterDeliveryCheckpoint: { findMany: vi.fn() },
  },
}));

describe("getDeliveryData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty newsletter payload when no newsletter exists for ticker", async () => {
    const { prisma } = await import("@mediapulse/database");
    vi.mocked(prisma.newsletter.findFirst).mockResolvedValue(null);

    const { getDeliveryData } = await import("./delivery.js");
    const result = await getDeliveryData("ticker-1");

    expect(result).toEqual({
      newsletter: null,
      subscribers: [],
      deliveredUserTickerIds: [],
    });
    expect(prisma.userTicker.findMany).not.toHaveBeenCalled();
  });

  it("returns newsletter, subscribers with userTickerId, and checkpoint ids", async () => {
    const { prisma } = await import("@mediapulse/database");
    const newsletter = {
      id: "n1",
      subject: "Subj",
      description: null,
      content: "Body",
      tickerId: "t1",
      model: null,
      agentVersion: null,
      configVersion: null,
      promptHash: null,
      configSnapshotId: null,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      ticker: { symbol: "AAPL" },
    };
    vi.mocked(prisma.newsletter.findFirst).mockResolvedValue(newsletter);
    vi.mocked(prisma.newsletterDeliveryCheckpoint.findMany).mockResolvedValue([
      {
        id: "cp1",
        newsletterId: "n1",
        userTickerId: "ut2",
        deliveredAt: new Date(),
        resendEmailId: null,
      },
    ]);
    const rows: UserTickerWithUserRow[] = [
      {
        id: "ut1",
        userId: "u1",
        tickerId: "t1",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: "u1",
          email: "a@example.com",
          name: "A",
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      {
        id: "ut2",
        userId: "u2",
        tickerId: "t1",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: "u2",
          email: "b@example.com",
          name: null,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];
    vi.mocked(prisma.userTicker.findMany).mockResolvedValue(
      rows as unknown as Awaited<ReturnType<typeof prisma.userTicker.findMany>>,
    );

    const { getDeliveryData } = await import("./delivery.js");
    const result = await getDeliveryData("t1");

    expect(prisma.userTicker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tickerId: "t1", enabled: true, user: { enabled: true } },
      }),
    );
    expect(result).toEqual({
      newsletter: {
        id: "n1",
        subject: "Subj",
        content: "Body",
        symbol: "AAPL",
      },
      subscribers: [
        { userTickerId: "ut1", email: "a@example.com" },
        { userTickerId: "ut2", email: "b@example.com" },
      ],
      deliveredUserTickerIds: ["ut2"],
    });
  });

  it("filters out empty emails", async () => {
    const { prisma } = await import("@mediapulse/database");
    const newsletter = {
      id: "n1",
      subject: "S",
      description: null,
      content: "C",
      tickerId: "t1",
      model: null,
      agentVersion: null,
      configVersion: null,
      promptHash: null,
      configSnapshotId: null,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ticker: { symbol: "BBRI" },
    };
    vi.mocked(prisma.newsletter.findFirst).mockResolvedValue(
      newsletter as unknown as Awaited<
        ReturnType<typeof prisma.newsletter.findFirst>
      >,
    );
    vi.mocked(prisma.newsletterDeliveryCheckpoint.findMany).mockResolvedValue(
      [],
    );
    const rows: UserTickerWithUserRow[] = [
      {
        id: "ut1",
        userId: "u1",
        tickerId: "t1",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: "u1",
          email: "",
          name: null,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];
    vi.mocked(prisma.userTicker.findMany).mockResolvedValue(
      rows as unknown as Awaited<ReturnType<typeof prisma.userTicker.findMany>>,
    );

    const { getDeliveryData } = await import("./delivery.js");
    const result = await getDeliveryData("t1");

    expect(result?.subscribers).toEqual([]);
  });
});
