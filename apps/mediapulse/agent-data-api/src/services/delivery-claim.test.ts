/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { FakeKnownRequestError } = vi.hoisted(() => {
  class FakeKnownRequestError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  }

  return { FakeKnownRequestError };
});

vi.mock("@mediapulse/database", () => ({
  prisma: {
    newsletterDeliveryCheckpoint: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

const newsletterId = "11111111-1111-4111-a111-111111111111";
const userTickerId = "22222222-2222-4222-a222-222222222222";

describe("claimDelivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns claimed:true after inserting the checkpoint row", async () => {
    const { prisma } = await import("@mediapulse/database");
    vi.mocked(prisma.newsletterDeliveryCheckpoint.create).mockResolvedValue(
      {} as Awaited<
        ReturnType<typeof prisma.newsletterDeliveryCheckpoint.create>
      >,
    );

    const { claimDelivery } = await import("./delivery-claim.js");
    const result = await claimDelivery({ userTickerId, newsletterId });

    expect(prisma.newsletterDeliveryCheckpoint.create).toHaveBeenCalledWith({
      data: { newsletterId, userTickerId },
    });
    expect(result).toEqual({ claimed: true });
  });

  it("returns claimed:false when the unique constraint rejects the insert", async () => {
    const { prisma } = await import("@mediapulse/database");
    vi.mocked(prisma.newsletterDeliveryCheckpoint.create).mockRejectedValue(
      new FakeKnownRequestError("duplicate", "P2002"),
    );

    const { claimDelivery } = await import("./delivery-claim.js");
    const result = await claimDelivery({ userTickerId, newsletterId });

    expect(result).toEqual({ claimed: false });
  });

  it("rethrows non-unique-constraint database errors", async () => {
    const { prisma } = await import("@mediapulse/database");
    vi.mocked(prisma.newsletterDeliveryCheckpoint.create).mockRejectedValue(
      new FakeKnownRequestError("connection lost", "P1001"),
    );

    const { claimDelivery } = await import("./delivery-claim.js");

    await expect(claimDelivery({ userTickerId, newsletterId })).rejects.toThrow(
      "connection lost",
    );
  });
});

describe("releaseDeliveryClaim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes only unfinalized claims and reports released:true when one was removed", async () => {
    const { prisma } = await import("@mediapulse/database");
    vi.mocked(prisma.newsletterDeliveryCheckpoint.deleteMany).mockResolvedValue(
      { count: 1 },
    );

    const { releaseDeliveryClaim } = await import("./delivery-claim.js");
    const result = await releaseDeliveryClaim({ userTickerId, newsletterId });

    expect(prisma.newsletterDeliveryCheckpoint.deleteMany).toHaveBeenCalledWith(
      {
        where: { newsletterId, userTickerId, resendEmailId: null },
      },
    );
    expect(result).toEqual({ released: true });
  });

  it("reports released:false when there was no unfinalized claim to remove", async () => {
    const { prisma } = await import("@mediapulse/database");
    vi.mocked(prisma.newsletterDeliveryCheckpoint.deleteMany).mockResolvedValue(
      { count: 0 },
    );

    const { releaseDeliveryClaim } = await import("./delivery-claim.js");
    const result = await releaseDeliveryClaim({ userTickerId, newsletterId });

    expect(result).toEqual({ released: false });
  });
});
