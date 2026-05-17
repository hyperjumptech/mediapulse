import { describe, expect, it } from "vitest";

import { mapRowToListItem, type NewsletterListRow } from "./list-mapper";

describe("newsletters list-mapper", () => {
  const baseRow = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    subject: "Apple weekly digest",
    description: null,
    content: "# body",
    tickerId: "11111111-1111-4111-a111-111111111111",
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-05-01T00:00:00.000Z"),
    model: null,
    agentVersion: null,
    configVersion: null,
    promptHash: null,
    configSnapshotId: null,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    ticker: { symbol: "AAPL", name: "Apple Inc." },
  } satisfies NewsletterListRow;

  it("maps a row with a real delivery aggregate", () => {
    const item = mapRowToListItem(baseRow, {
      deliveryDelivered: 4,
      deliveryEnabledAtSendTime: 5,
      deliveryHasRun: true,
    });
    expect(item).toEqual({
      id: baseRow.id,
      subject: "Apple weekly digest",
      description: null,
      tickerId: baseRow.tickerId,
      tickerSymbol: "AAPL",
      tickerName: "Apple Inc.",
      createdAt: "2026-05-01T00:00:00.000Z",
      deliveryDelivered: 4,
      deliveryEnabledAtSendTime: 5,
      deliveryHasRun: true,
    });
  });

  it("propagates `deliveryHasRun: false` for the pre-run fallback", () => {
    const item = mapRowToListItem(baseRow, {
      deliveryDelivered: 0,
      deliveryEnabledAtSendTime: 3,
      deliveryHasRun: false,
    });
    expect(item.deliveryHasRun).toBe(false);
    expect(item.deliveryEnabledAtSendTime).toBe(3);
  });
});
