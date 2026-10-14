/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  countSubscriberTickerDeliveries,
  countSubscriberTickerWelcomes,
  type SubscriberTickerDeliveriesDb,
  type SubscriberTickerWelcomesDb,
} from "./subscriber-ticker-deliveries.js";

describe("countSubscriberTickerDeliveries", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("counts finalized sends to the user for the ticker in any language", async () => {
    const count = vi.fn().mockResolvedValue(2);
    const db = {
      newsletterDeliveryCheckpoint: { count },
    } as unknown as SubscriberTickerDeliveriesDb;

    const deliveries = await countSubscriberTickerDeliveries(db, {
      userId: "user-1",
      tickerId: "ticker-1",
    });

    expect(deliveries).toBe(2);
    expect(count).toHaveBeenCalledWith({
      where: {
        resendEmailId: { not: null },
        userTicker: { userId: "user-1", tickerId: "ticker-1" },
      },
    });
  });
});

describe("countSubscriberTickerWelcomes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("counts welcomes sent or being sent to the user for the ticker in any language", async () => {
    const count = vi.fn().mockResolvedValue(1);
    const db = {
      day1NewsletterDispatch: { count },
    } as unknown as SubscriberTickerWelcomesDb;

    const welcomes = await countSubscriberTickerWelcomes(db, {
      userId: "user-1",
      tickerId: "ticker-1",
    });

    expect(welcomes).toBe(1);
    expect(count).toHaveBeenCalledWith({
      where: {
        welcomeClaimedAt: { not: null },
        userTicker: { userId: "user-1", tickerId: "ticker-1" },
      },
    });
  });
});
