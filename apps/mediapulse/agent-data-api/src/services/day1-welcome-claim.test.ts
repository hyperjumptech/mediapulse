/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  claimDay1Welcome,
  recordDay1WelcomeSent,
  releaseDay1WelcomeClaim,
  type Day1WelcomeClaimDb,
} from "./day1-welcome-claim.js";

const NOW = new Date("2026-10-14T03:00:00.000Z");
const DISPATCH_ID = "11111111-1111-4111-8111-111111111111";

const createDb = (updatedCount: number) => {
  const updateMany = vi.fn().mockResolvedValue({ count: updatedCount });
  const update = vi.fn().mockResolvedValue({});
  const db = {
    day1NewsletterDispatch: { updateMany, update },
  } as unknown as Day1WelcomeClaimDb;

  return { db, updateMany, update };
};

describe("claimDay1Welcome", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("claims an unsent welcome that is unclaimed or whose claim went stale", async () => {
    const { db, updateMany } = createDb(1);

    const result = await claimDay1Welcome(db, { dispatchId: DISPATCH_ID }, NOW);

    expect(result).toEqual({ claimed: true });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: DISPATCH_ID,
        kind: "welcome",
        welcomeSentAt: null,
        OR: [
          { welcomeClaimedAt: null },
          { welcomeClaimedAt: { lt: new Date("2026-10-14T02:30:00.000Z") } },
        ],
      },
      data: { welcomeClaimedAt: NOW },
    });
  });

  it("refuses when another run already claimed it", async () => {
    const { db } = createDb(0);

    const result = await claimDay1Welcome(db, { dispatchId: DISPATCH_ID }, NOW);

    expect(result).toEqual({ claimed: false });
  });
});

describe("releaseDay1WelcomeClaim", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clears only a claim whose welcome was never sent", async () => {
    const { db, updateMany } = createDb(1);

    const result = await releaseDay1WelcomeClaim(db, {
      dispatchId: DISPATCH_ID,
    });

    expect(result).toEqual({ released: true });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: DISPATCH_ID, welcomeSentAt: null },
      data: { welcomeClaimedAt: null },
    });
  });

  it("reports nothing released once the welcome was sent", async () => {
    const { db } = createDb(0);

    const result = await releaseDay1WelcomeClaim(db, {
      dispatchId: DISPATCH_ID,
    });

    expect(result).toEqual({ released: false });
  });
});

describe("recordDay1WelcomeSent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores when the welcome went out and its Resend id", async () => {
    const { db, update } = createDb(0);

    await recordDay1WelcomeSent(
      db,
      { dispatchId: DISPATCH_ID, resendEmailId: "re_1" },
      NOW,
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: DISPATCH_ID },
      data: { welcomeSentAt: NOW, welcomeResendEmailId: "re_1" },
    });
  });
});
