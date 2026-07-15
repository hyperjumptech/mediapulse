import { describe, expect, it, vi } from "vitest";

import { buildDelivery } from "./build-delivery";

describe("buildDelivery", () => {
  it("builds KPIs from the latest delivery run and the recipient counts", async () => {
    const runFindFirst = vi.fn().mockResolvedValue({
      agentId: "delivery",
      agentVersion: "1.2.0",
      outcome: "partial_success",
      createdAt: new Date("2026-07-13T06:00:00.000Z"),
    });

    const result = await buildDelivery(
      "nl-1",
      { delivered: 12, total: 15 },
      { deliveryRun: { findFirst: runFindFirst } },
    );

    expect(runFindFirst.mock.calls[0]?.[0]?.where).toEqual({
      newsletterId: "nl-1",
    });
    expect(result).toStrictEqual({
      agentLabel: "delivery - 1.2.0",
      deliveredAtLabel: "July 13, 2026 at 13:00",
      outcomeLabel: "Partial",
      outcomeVariant: "warning",
      deliveredLabel: "12 / 15",
    });
  });

  it("maps a success outcome to a green variant", async () => {
    const result = await buildDelivery(
      "nl-1",
      { delivered: 15, total: 15 },
      {
        deliveryRun: {
          findFirst: vi.fn().mockResolvedValue({
            agentId: "delivery",
            agentVersion: "1.2.0",
            outcome: "success",
            createdAt: new Date("2026-07-13T06:00:00.000Z"),
          }),
        },
      },
    );

    expect(result.outcomeLabel).toBe("Success");
    expect(result.outcomeVariant).toBe("success");
    expect(result.deliveredLabel).toBe("15 / 15");
  });

  it("falls back to placeholders when no delivery run exists", async () => {
    const result = await buildDelivery(
      "nl-1",
      { delivered: 0, total: 0 },
      { deliveryRun: { findFirst: vi.fn().mockResolvedValue(null) } },
    );

    expect(result).toStrictEqual({
      agentLabel: "delivery",
      deliveredAtLabel: "—",
      outcomeLabel: "—",
      outcomeVariant: "muted",
      deliveredLabel: "0 / 0",
    });
  });
});
