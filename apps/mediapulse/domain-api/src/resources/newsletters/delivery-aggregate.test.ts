import { describe, expect, it, vi } from "vitest";

import { buildDeliveryAggregateMap } from "./delivery-aggregate";

const newsletterId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const tickerId = "11111111-1111-4111-a111-111111111111";

const makeDeps = (overrides: {
  checkpoints?: Array<{ newsletterId: string; _count: { _all: number } }>;
  runs?: Array<{
    newsletterId: string | null;
    successCount: number;
    failureCount: number;
    skippedCount: number;
  }>;
  userTickers?: Array<{ tickerId: string; _count: { _all: number } }>;
}) => ({
  newsletterDeliveryCheckpoint: {
    groupBy: vi.fn().mockResolvedValue(overrides.checkpoints ?? []),
  },
  deliveryRun: {
    findMany: vi.fn().mockResolvedValue(overrides.runs ?? []),
  },
  userTicker: {
    groupBy: vi.fn().mockResolvedValue(overrides.userTickers ?? []),
  },
});

describe("buildDeliveryAggregateMap", () => {
  it("returns an empty map when given no newsletters", async () => {
    const deps = makeDeps({});
    const result = await buildDeliveryAggregateMap([], deps);
    expect(result.size).toBe(0);
    expect(deps.deliveryRun.findMany).not.toHaveBeenCalled();
  });

  it("uses the latest DeliveryRun for the enabled-at-send-time count", async () => {
    const deps = makeDeps({
      checkpoints: [{ newsletterId, _count: { _all: 3 } }],
      runs: [
        {
          newsletterId,
          successCount: 3,
          failureCount: 1,
          skippedCount: 1,
        },
        {
          newsletterId,
          successCount: 2,
          failureCount: 0,
          skippedCount: 0,
        },
      ],
    });
    const result = await buildDeliveryAggregateMap(
      [{ id: newsletterId, tickerId }],
      deps,
    );
    expect(result.get(newsletterId)).toEqual({
      deliveryDelivered: 3,
      deliveryEnabledAtSendTime: 5,
      deliveryHasRun: true,
    });
  });

  it("falls back to the current enabled UserTicker count pre-run", async () => {
    const deps = makeDeps({
      userTickers: [{ tickerId, _count: { _all: 12 } }],
    });
    const result = await buildDeliveryAggregateMap(
      [{ id: newsletterId, tickerId }],
      deps,
    );
    expect(result.get(newsletterId)).toEqual({
      deliveryDelivered: 0,
      deliveryEnabledAtSendTime: 12,
      deliveryHasRun: false,
    });
  });

  it("returns a zero aggregate when no run and no enabled subscribers exist", async () => {
    const deps = makeDeps({});
    const result = await buildDeliveryAggregateMap(
      [{ id: newsletterId, tickerId }],
      deps,
    );
    expect(result.get(newsletterId)).toEqual({
      deliveryDelivered: 0,
      deliveryEnabledAtSendTime: 0,
      deliveryHasRun: false,
    });
  });

  it("batches multiple newsletters in a single follow-up query", async () => {
    const deps = makeDeps({
      checkpoints: [{ newsletterId, _count: { _all: 1 } }],
      runs: [
        {
          newsletterId,
          successCount: 1,
          failureCount: 0,
          skippedCount: 0,
        },
      ],
      userTickers: [{ tickerId, _count: { _all: 5 } }],
    });

    await buildDeliveryAggregateMap(
      [
        { id: newsletterId, tickerId },
        { id: otherId, tickerId },
      ],
      deps,
    );

    expect(deps.newsletterDeliveryCheckpoint.groupBy).toHaveBeenCalledTimes(1);
    expect(deps.deliveryRun.findMany).toHaveBeenCalledTimes(1);
    expect(deps.userTicker.groupBy).toHaveBeenCalledTimes(1);
    expect(deps.deliveryRun.findMany.mock.calls[0]?.[0]?.where).toEqual({
      newsletterId: { in: [newsletterId, otherId] },
    });
  });

  it("counts only user tickers whose user account is enabled", async () => {
    const deps = makeDeps({
      userTickers: [{ tickerId, _count: { _all: 4 } }],
    });

    await buildDeliveryAggregateMap([{ id: newsletterId, tickerId }], deps);

    expect(deps.userTicker.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tickerId: { in: [tickerId] },
          enabled: true,
          user: { enabled: true },
        },
      }),
    );
  });
});
