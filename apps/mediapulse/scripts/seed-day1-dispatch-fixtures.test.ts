/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  DAY1_DISPATCH_FIXTURES,
  DAY1_FIXTURE_PREFIX,
  removeDay1DispatchFixtures,
  seedDay1DispatchFixtures,
} from "./seed-day1-dispatch-fixtures";

const buildDb = (tickers: Array<{ id: string }>) => ({
  ticker: { findMany: vi.fn().mockResolvedValue(tickers) },
  mediapulseUser: {
    create: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  userTicker: {
    create: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  day1NewsletterDispatch: {
    create: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
});

describe("seedDay1DispatchFixtures", () => {
  it("creates one prefixed user, subscription and dispatch per fixture", async () => {
    const db = buildDb([{ id: "ticker-a" }, { id: "ticker-b" }]);
    const now = new Date("2026-09-29T08:00:00.000Z");

    const seeded = await seedDay1DispatchFixtures(db as never, now);

    expect(seeded).toBe(DAY1_DISPATCH_FIXTURES.length);
    expect(db.day1NewsletterDispatch.create).toHaveBeenCalledTimes(
      DAY1_DISPATCH_FIXTURES.length,
    );
    expect(db.day1NewsletterDispatch.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        id: `${DAY1_FIXTURE_PREFIX}dispatch-1`,
        userTickerId: `${DAY1_FIXTURE_PREFIX}subscription-1`,
        tickerId: "ticker-a",
        kind: "bootstrap",
        status: "fired",
        createdAt: new Date("2026-09-29T07:55:00.000Z"),
      }),
    });
    expect(db.day1NewsletterDispatch.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({ tickerId: "ticker-b" }),
    });
  });

  it("refuses to seed without any ticker", async () => {
    const db = buildDb([]);

    await expect(
      seedDay1DispatchFixtures(db as never, new Date()),
    ).rejects.toThrow("no tickers");
  });
});

describe("removeDay1DispatchFixtures", () => {
  it("deletes only prefixed rows, dispatches first", async () => {
    const db = buildDb([]);

    await removeDay1DispatchFixtures(db as never);

    const byPrefix = { where: { id: { startsWith: DAY1_FIXTURE_PREFIX } } };
    expect(db.day1NewsletterDispatch.deleteMany).toHaveBeenCalledWith(byPrefix);
    expect(db.userTicker.deleteMany).toHaveBeenCalledWith(byPrefix);
    expect(db.mediapulseUser.deleteMany).toHaveBeenCalledWith(byPrefix);
  });
});
