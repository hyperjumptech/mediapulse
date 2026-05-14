import { describe, expect, it, vi } from "vitest";

import {
  buildRecipients,
  NEWSLETTER_DETAIL_RECIPIENTS_CAP,
  type BuildRecipientsDeps,
} from "./build-recipients";

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
  it("returns delivered for users with a checkpoint", async () => {
    const deps = makeDeps({
      userTicker: {
        findMany: vi.fn().mockResolvedValue([{ id: "ut-1" }]),
      },
      newsletterDeliveryCheckpoint: {
        findMany: vi.fn().mockResolvedValue([{ userTickerId: "ut-1" }]),
      },
    });

    const result = await buildRecipients("nl-1", "tk-1", deps);

    expect(result.recipients).toStrictEqual([
      {
        userTickerId: "ut-1",
        status: "delivered",
        attempts: 0,
        lastErrorCode: null,
        errorCategory: null,
        resendEmailId: null,
        inconsistent: false,
      },
    ]);
    expect(result.truncated).toBe(false);
    expect(result.notAttemptedAtSendTime).toStrictEqual([]);
  });

  it("flags inconsistent when latest outcome is success without a checkpoint", async () => {
    const deps = makeDeps({
      userTicker: {
        findMany: vi.fn().mockResolvedValue([{ id: "ut-2" }]),
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
      inconsistent: true,
      resendEmailId: "rs-9",
    });
    expect(result.inconsistentUserTickerIds).toStrictEqual(["ut-2"]);
  });

  it("returns failed and skipped from latest outcome when no checkpoint", async () => {
    const deps = makeDeps({
      userTicker: {
        findMany: vi.fn().mockResolvedValue([{ id: "ut-3" }, { id: "ut-4" }]),
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
                errorCategory: "transient",
                resendEmailId: null,
              },
              {
                userTickerId: "ut-4",
                status: "skipped",
                attempts: 0,
                lastErrorCode: null,
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
    expect(byId.get("ut-3")?.status).toBe("failed");
    expect(byId.get("ut-3")?.lastErrorCode).toBe("ERR_X");
    expect(byId.get("ut-4")?.status).toBe("skipped");
  });

  it("returns not_attempted for enabled subscribers missing from the run", async () => {
    const deps = makeDeps({
      userTicker: {
        findMany: vi.fn().mockResolvedValue([{ id: "ut-5" }]),
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
      attempts: 0,
    });
    expect(result.notAttemptedAtSendTime).toStrictEqual([
      { userTickerId: "ut-5", runId: "run-3" },
    ]);
  });

  it("only keeps the latest run outcome per user across runs", async () => {
    const deps = makeDeps({
      userTicker: {
        findMany: vi.fn().mockResolvedValue([{ id: "ut-6" }]),
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

  it("truncates results to the configured cap and sets truncated=true", async () => {
    const total = NEWSLETTER_DETAIL_RECIPIENTS_CAP + 5;
    const enabledRows = Array.from({ length: total }, (_, idx) => ({
      id: `ut-${idx}`,
    }));
    const deps = makeDeps({
      userTicker: {
        findMany: vi.fn().mockResolvedValue(enabledRows),
      },
    });

    const result = await buildRecipients("nl-1", "tk-1", deps);

    expect(result.truncated).toBe(true);
    expect(result.recipients).toHaveLength(NEWSLETTER_DETAIL_RECIPIENTS_CAP);
  });
});
