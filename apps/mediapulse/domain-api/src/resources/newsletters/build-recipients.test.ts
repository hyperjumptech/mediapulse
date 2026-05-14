import { describe, expect, it, vi } from "vitest";

import {
  buildRecipients,
  NEWSLETTER_DETAIL_RECIPIENTS_CAP,
  type BuildRecipientsDeps,
} from "./build-recipients";

const enabled = (
  id: string,
  email: string | null = `${id}@example.com`,
  name: string | null = null,
) => ({ id, user: { email, name } });

const makeDeps = (
  overrides: Partial<BuildRecipientsDeps>,
): BuildRecipientsDeps => ({
  userTicker: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  newsletterDeliveryCheckpoint: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  deliveryRun: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  ...overrides,
});

describe("buildRecipients", () => {
  it("returns delivered with success badge and the checkpoint deliveredAt", async () => {
    const deliveredAt = new Date("2026-05-14T11:30:00.000Z");
    const deps = makeDeps({
      userTicker: {
        findMany: vi.fn().mockResolvedValue([enabled("ut-1")]),
      },
      newsletterDeliveryCheckpoint: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ userTickerId: "ut-1", deliveredAt }]),
      },
    });

    const result = await buildRecipients("nl-1", "tk-1", deps);

    expect(result.recipients).toHaveLength(1);
    expect(result.recipients[0]).toMatchObject({
      userTickerId: "ut-1",
      email: "ut-1@example.com",
      displayName: "ut-1@example.com",
      status: "delivered",
      statusBadge: "success",
      deliveredAt: deliveredAt.toISOString(),
      inconsistent: false,
    });
    expect(result.deliveredCount).toBe(1);
  });

  it("flags inconsistent when latest outcome is success without a checkpoint", async () => {
    const deps = makeDeps({
      userTicker: {
        findMany: vi.fn().mockResolvedValue([enabled("ut-2")]),
      },
      deliveryRun: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "run-1",
            createdAt: new Date("2026-05-14T10:00:00.000Z"),
            recipients: [
              {
                userTickerId: "ut-2",
                status: "success",
                attempts: 1,
                lastErrorCode: null,
                lastErrorMessage: null,
                errorCategory: null,
                resendEmailId: "rs-9",
              },
            ],
          },
        ]),
      },
    });

    const result = await buildRecipients("nl-1", "tk-1", deps);

    expect(result.recipients[0]).toMatchObject({
      userTickerId: "ut-2",
      status: "delivered",
      statusBadge: "success",
      inconsistent: true,
      resendEmailId: "rs-9",
    });
    expect(result.inconsistentUserTickerIds).toStrictEqual(["ut-2"]);
  });

  it("returns failed/skipped from latest outcome with matching badges", async () => {
    const deps = makeDeps({
      userTicker: {
        findMany: vi.fn().mockResolvedValue([enabled("ut-3"), enabled("ut-4")]),
      },
      deliveryRun: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "run-2",
            createdAt: new Date("2026-05-14T10:00:00.000Z"),
            recipients: [
              {
                userTickerId: "ut-3",
                status: "failed",
                attempts: 2,
                lastErrorCode: "ERR_X",
                lastErrorMessage: "rate limited",
                errorCategory: "transient",
                resendEmailId: null,
              },
              {
                userTickerId: "ut-4",
                status: "skipped",
                attempts: 0,
                lastErrorCode: null,
                lastErrorMessage: null,
                errorCategory: null,
                resendEmailId: null,
              },
            ],
          },
        ]),
      },
    });

    const result = await buildRecipients("nl-1", "tk-1", deps);

    const byId = new Map(result.recipients.map((r) => [r.userTickerId, r]));
    expect(byId.get("ut-3")).toMatchObject({
      status: "failed",
      statusBadge: "destructive",
      lastErrorCode: "ERR_X",
      lastErrorMessage: "rate limited",
    });
    expect(byId.get("ut-4")).toMatchObject({
      status: "skipped",
      statusBadge: "muted",
    });
  });

  it("returns not_attempted with outline badge and null attempts", async () => {
    const deps = makeDeps({
      userTicker: {
        findMany: vi.fn().mockResolvedValue([enabled("ut-5")]),
      },
      deliveryRun: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "run-3",
            createdAt: new Date("2026-05-14T10:00:00.000Z"),
            recipients: [],
          },
        ]),
      },
    });

    const result = await buildRecipients("nl-1", "tk-1", deps);

    expect(result.recipients[0]).toMatchObject({
      userTickerId: "ut-5",
      status: "not_attempted",
      statusBadge: "outline",
      attempts: null,
      deliveredAt: null,
    });
    expect(result.notAttemptedAtSendTime).toStrictEqual([
      { userTickerId: "ut-5", runId: "run-3" },
    ]);
    expect(result.enabledAtSendTime).toBe(0);
  });

  it("builds displayName as `Name <email>` when name is present", async () => {
    const deps = makeDeps({
      userTicker: {
        findMany: vi
          .fn()
          .mockResolvedValue([enabled("ut-x", "x@example.com", "Alice")]),
      },
      newsletterDeliveryCheckpoint: {
        findMany: vi.fn().mockResolvedValue([
          {
            userTickerId: "ut-x",
            deliveredAt: new Date("2026-05-14T12:00:00.000Z"),
          },
        ]),
      },
    });

    const result = await buildRecipients("nl-1", "tk-1", deps);

    expect(result.recipients[0]?.displayName).toBe("Alice <x@example.com>");
  });

  it("sorts recipients alphabetically by email", async () => {
    const deps = makeDeps({
      userTicker: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            enabled("ut-zed", "zed@example.com"),
            enabled("ut-alice", "alice@example.com"),
          ]),
      },
    });

    const result = await buildRecipients("nl-1", "tk-1", deps);

    expect(result.recipients.map((r) => r.email)).toStrictEqual([
      "alice@example.com",
      "zed@example.com",
    ]);
  });

  it("computes enabledAtSendTime from the latest run recipient count", async () => {
    const deps = makeDeps({
      userTicker: {
        findMany: vi.fn().mockResolvedValue([enabled("ut-a")]),
      },
      deliveryRun: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "run-late",
            createdAt: new Date("2026-05-14T10:00:00.000Z"),
            recipients: [
              {
                userTickerId: "ut-a",
                status: "success",
                attempts: 1,
                lastErrorCode: null,
                lastErrorMessage: null,
                errorCategory: null,
                resendEmailId: "rs-1",
              },
              {
                userTickerId: "ut-extinct",
                status: "skipped",
                attempts: 0,
                lastErrorCode: null,
                lastErrorMessage: null,
                errorCategory: null,
                resendEmailId: null,
              },
            ],
          },
        ]),
      },
    });

    const result = await buildRecipients("nl-1", "tk-1", deps);

    expect(result.enabledAtSendTime).toBe(2);
  });

  it("only keeps the latest run outcome per user across runs", async () => {
    const deps = makeDeps({
      userTicker: {
        findMany: vi.fn().mockResolvedValue([enabled("ut-6")]),
      },
      deliveryRun: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "run-latest",
            createdAt: new Date("2026-05-14T10:00:00.000Z"),
            recipients: [
              {
                userTickerId: "ut-6",
                status: "failed",
                attempts: 3,
                lastErrorCode: "LATE",
                lastErrorMessage: "boom",
                errorCategory: null,
                resendEmailId: null,
              },
            ],
          },
          {
            id: "run-older",
            createdAt: new Date("2026-05-13T10:00:00.000Z"),
            recipients: [
              {
                userTickerId: "ut-6",
                status: "skipped",
                attempts: 0,
                lastErrorCode: null,
                lastErrorMessage: null,
                errorCategory: null,
                resendEmailId: null,
              },
            ],
          },
        ]),
      },
    });

    const result = await buildRecipients("nl-1", "tk-1", deps);

    expect(result.recipients[0]?.status).toBe("failed");
    expect(result.recipients[0]?.lastErrorCode).toBe("LATE");
  });

  it("truncates results to the configured cap and sets totalCount before capping", async () => {
    const total = NEWSLETTER_DETAIL_RECIPIENTS_CAP + 5;
    const enabledRows = Array.from({ length: total }, (_, idx) =>
      enabled(`ut-${String(idx).padStart(5, "0")}`),
    );
    const deps = makeDeps({
      userTicker: {
        findMany: vi.fn().mockResolvedValue(enabledRows),
      },
    });

    const result = await buildRecipients("nl-1", "tk-1", deps);

    expect(result.truncated).toBe(true);
    expect(result.recipients).toHaveLength(NEWSLETTER_DETAIL_RECIPIENTS_CAP);
    expect(result.totalCount).toBe(total);
  });
});
