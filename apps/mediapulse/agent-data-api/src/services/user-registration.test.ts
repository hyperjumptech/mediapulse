/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {
    ticker: { findUnique: vi.fn() },
    mediapulseUser: { upsert: vi.fn() },
    userTicker: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const TICKER = {
  id: "ticker-uuid-1",
  symbol: "BBCA",
  name: "Bank BCA",
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const USER = {
  id: "user-uuid-1",
  email: "alice@example.com",
  name: "alice",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const makeUserTicker = (
  overrides: Partial<{
    id: string;
    enabled: boolean;
    registrationConfirmedAt: Date | null;
  }> = {},
) => ({
  id: "ut-uuid-1",
  userId: USER.id,
  tickerId: TICKER.id,
  enabled: true,
  registrationConfirmedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("processRegistration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["lowercase", "bbca"],
    ["mixed-case", "BbCa"],
    ["surrounding whitespace", " BBCA "],
  ])("normalizes %s symbol before lookup", async (_label, symbol) => {
    const { prisma } = await import("@mediapulse/database");
    vi.mocked(prisma.ticker.findUnique).mockResolvedValue(null);

    const { processRegistration } = await import("./user-registration.js");
    await processRegistration({
      email: "alice@example.com",
      tickerSymbol: symbol,
    });

    expect(prisma.ticker.findUnique).toHaveBeenCalledWith({
      where: { symbol: "BBCA" },
    });
  });

  it("returns tickerKnown: false when ticker does not exist", async () => {
    const { prisma } = await import("@mediapulse/database");
    vi.mocked(prisma.ticker.findUnique).mockResolvedValue(null);

    const { processRegistration } = await import("./user-registration.js");
    const result = await processRegistration({
      email: "alice@example.com",
      tickerSymbol: "UNKNOWN",
    });

    expect(result).toEqual({
      tickerKnown: false,
      userTickerId: undefined,
      isNewSubscription: false,
      subscriptionChanged: false,
    });
    expect(prisma.mediapulseUser.upsert).not.toHaveBeenCalled();
    expect(prisma.userTicker.create).not.toHaveBeenCalled();
  });

  it("creates user and subscription when ticker is known and no prior subscription exists", async () => {
    const { prisma } = await import("@mediapulse/database");
    vi.mocked(prisma.ticker.findUnique).mockResolvedValue(TICKER);
    vi.mocked(prisma.mediapulseUser.upsert).mockResolvedValue(USER);
    vi.mocked(prisma.userTicker.findUnique).mockResolvedValue(null);
    const newUserTicker = makeUserTicker({ registrationConfirmedAt: null });
    vi.mocked(prisma.userTicker.create).mockResolvedValue(
      newUserTicker as unknown as Awaited<
        ReturnType<typeof prisma.userTicker.create>
      >,
    );

    const { processRegistration } = await import("./user-registration.js");
    const result = await processRegistration({
      email: "alice@example.com",
      tickerSymbol: "BBCA",
      name: "alice",
    });

    expect(result).toEqual({
      tickerKnown: true,
      userTickerId: newUserTicker.id,
      isNewSubscription: true,
      subscriptionChanged: true,
    });
    expect(prisma.userTicker.create).toHaveBeenCalledWith({
      data: {
        userId: USER.id,
        tickerId: TICKER.id,
        enabled: true,
        registrationConfirmedAt: null,
      },
    });
    expect(prisma.userTicker.update).not.toHaveBeenCalled();
  });

  it("returns isNewSubscription: false and subscriptionChanged: false when subscription already exists and is enabled and confirmed", async () => {
    const { prisma } = await import("@mediapulse/database");
    const existingUserTicker = makeUserTicker({
      enabled: true,
      registrationConfirmedAt: new Date(),
    });
    vi.mocked(prisma.ticker.findUnique).mockResolvedValue(TICKER);
    vi.mocked(prisma.mediapulseUser.upsert).mockResolvedValue(USER);
    vi.mocked(prisma.userTicker.findUnique).mockResolvedValue(
      existingUserTicker as unknown as Awaited<
        ReturnType<typeof prisma.userTicker.findUnique>
      >,
    );

    const { processRegistration } = await import("./user-registration.js");
    const result = await processRegistration({
      email: "alice@example.com",
      tickerSymbol: "BBCA",
    });

    expect(result).toEqual({
      tickerKnown: true,
      userTickerId: existingUserTicker.id,
      isNewSubscription: false,
      subscriptionChanged: false,
    });
    expect(prisma.userTicker.create).not.toHaveBeenCalled();
    expect(prisma.userTicker.update).not.toHaveBeenCalled();
  });

  it("re-enables and marks isNewSubscription: true when subscription exists but is disabled and unconfirmed", async () => {
    const { prisma } = await import("@mediapulse/database");
    const disabledUserTicker = makeUserTicker({
      enabled: false,
      registrationConfirmedAt: null,
    });
    vi.mocked(prisma.ticker.findUnique).mockResolvedValue(TICKER);
    vi.mocked(prisma.mediapulseUser.upsert).mockResolvedValue(USER);
    vi.mocked(prisma.userTicker.findUnique).mockResolvedValue(
      disabledUserTicker as unknown as Awaited<
        ReturnType<typeof prisma.userTicker.findUnique>
      >,
    );
    vi.mocked(prisma.userTicker.update).mockResolvedValue(
      makeUserTicker({ enabled: true }) as unknown as Awaited<
        ReturnType<typeof prisma.userTicker.update>
      >,
    );

    const { processRegistration } = await import("./user-registration.js");
    const result = await processRegistration({
      email: "alice@example.com",
      tickerSymbol: "BBCA",
    });

    expect(result).toEqual({
      tickerKnown: true,
      userTickerId: disabledUserTicker.id,
      isNewSubscription: true,
      subscriptionChanged: true,
    });
    expect(prisma.userTicker.update).toHaveBeenCalledWith({
      where: { id: disabledUserTicker.id },
      data: { enabled: true },
    });
    expect(prisma.userTicker.create).not.toHaveBeenCalled();
  });

  it("returns isNewSubscription: true when subscription exists, is enabled, but was never confirmed", async () => {
    const { prisma } = await import("@mediapulse/database");
    const unconfirmedUserTicker = makeUserTicker({
      enabled: true,
      registrationConfirmedAt: null,
    });
    vi.mocked(prisma.ticker.findUnique).mockResolvedValue(TICKER);
    vi.mocked(prisma.mediapulseUser.upsert).mockResolvedValue(USER);
    vi.mocked(prisma.userTicker.findUnique).mockResolvedValue(
      unconfirmedUserTicker as unknown as Awaited<
        ReturnType<typeof prisma.userTicker.findUnique>
      >,
    );

    const { processRegistration } = await import("./user-registration.js");
    const result = await processRegistration({
      email: "alice@example.com",
      tickerSymbol: "BBCA",
    });

    expect(result).toEqual({
      tickerKnown: true,
      userTickerId: unconfirmedUserTicker.id,
      isNewSubscription: true,
      subscriptionChanged: false,
    });
    expect(prisma.userTicker.update).not.toHaveBeenCalled();
  });
});

describe("confirmRegistration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates registrationConfirmedAt and enabled on the UserTicker row", async () => {
    const { prisma } = await import("@mediapulse/database");
    vi.mocked(prisma.userTicker.update).mockResolvedValue(
      makeUserTicker({
        registrationConfirmedAt: new Date(),
      }) as unknown as Awaited<ReturnType<typeof prisma.userTicker.update>>,
    );

    const { confirmRegistration } = await import("./user-registration.js");
    const result = await confirmRegistration({ userTickerId: "ut-uuid-1" });

    expect(result).toEqual({ success: true });
    expect(prisma.userTicker.update).toHaveBeenCalledWith({
      where: { id: "ut-uuid-1" },
      data: {
        registrationConfirmedAt: expect.any(Date),
        enabled: true,
      },
    });
  });
});

describe("processRegistration with immediate confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sets registrationConfirmedAt when confirmed: true is passed for new subscription", async () => {
    const { prisma } = await import("@mediapulse/database");
    vi.mocked(prisma.ticker.findUnique).mockResolvedValue(TICKER);
    vi.mocked(prisma.mediapulseUser.upsert).mockResolvedValue(USER);
    vi.mocked(prisma.userTicker.findUnique).mockResolvedValue(null);
    const newUserTicker = makeUserTicker({ registrationConfirmedAt: new Date() });
    vi.mocked(prisma.userTicker.create).mockResolvedValue(
      newUserTicker as unknown as Awaited<
        ReturnType<typeof prisma.userTicker.create>
      >,
    );

    const { processRegistration } = await import("./user-registration.js");
    const result = await processRegistration({
      email: "alice@example.com",
      tickerSymbol: "BBCA",
      confirmed: true,
    });

    expect(result.isNewSubscription).toBe(true);
    expect(prisma.userTicker.create).toHaveBeenCalledWith({
      data: {
        userId: USER.id,
        tickerId: TICKER.id,
        enabled: true,
        registrationConfirmedAt: expect.any(Date),
      },
    });
  });

  it("updates registrationConfirmedAt when confirmed: true is passed for existing unconfirmed subscription", async () => {
    const { prisma } = await import("@mediapulse/database");
    const unconfirmedUserTicker = makeUserTicker({
      enabled: true,
      registrationConfirmedAt: null,
    });
    vi.mocked(prisma.ticker.findUnique).mockResolvedValue(TICKER);
    vi.mocked(prisma.mediapulseUser.upsert).mockResolvedValue(USER);
    vi.mocked(prisma.userTicker.findUnique).mockResolvedValue(
      unconfirmedUserTicker as unknown as Awaited<
        ReturnType<typeof prisma.userTicker.findUnique>
      >,
    );

    const { processRegistration } = await import("./user-registration.js");
    await processRegistration({
      email: "alice@example.com",
      tickerSymbol: "BBCA",
      confirmed: true,
    });

    expect(prisma.userTicker.update).toHaveBeenCalledWith({
      where: { id: unconfirmedUserTicker.id },
      data: {
        enabled: true,
        registrationConfirmedAt: expect.any(Date),
      },
    });
  });
});
