import { describe, expect, it } from "vitest";

import {
  mapRowToDetailItem,
  mapRowToListItem,
  type DeliveryRunDetailRow,
  type DeliveryRunListRow,
} from "./list-mapper";

describe("delivery-runs list-mapper", () => {
  it("mapRowToListItem maps joined ticker symbol", () => {
    const row = {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      agentId: "delivery",
      agentVersion: "1.0.0",
      tickerId: "11111111-1111-4111-a111-111111111111",
      newsletterId: null,
      outcome: "success",
      stage: "send",
      successCount: 1,
      failureCount: 0,
      skippedCount: 0,
      durationMs: 42,
      scheduleExecutionId: null,
      hermesScheduleId: null,
      pipelineStepId: null,
      jobId: null,
      hermesExecutionId: null,
      runSkipReason: null,
      resendMessageIds: ["re_1"],
      recipientErrorSummary: null,
      createdAt: new Date("2026-01-01T12:00:00.000Z"),
      ticker: { symbol: "ACME" },
    } satisfies DeliveryRunListRow;

    expect(mapRowToListItem(row)).toEqual({
      id: row.id,
      createdAt: "2026-01-01T12:00:00.000Z",
      tickerSymbol: "ACME",
      outcome: "success",
      successCount: 1,
      failureCount: 0,
      skippedCount: 0,
      durationMs: 42,
      jobId: null,
      runSkipReason: null,
      recipientErrorSummary: null,
    });
  });

  it("mapRowToDetailItem stringifies recipients and resend ids", () => {
    const row = {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      agentId: "delivery",
      agentVersion: "1.0.0",
      tickerId: "11111111-1111-4111-a111-111111111111",
      newsletterId: null,
      outcome: "partial_success",
      stage: "send",
      successCount: 1,
      failureCount: 1,
      skippedCount: 0,
      durationMs: 100,
      scheduleExecutionId: null,
      hermesScheduleId: null,
      pipelineStepId: null,
      jobId: null,
      hermesExecutionId: null,
      runSkipReason: null,
      resendMessageIds: ["a", "b"],
      recipientErrorSummary: "x",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      ticker: { symbol: "FOO" },
      recipients: [
        {
          id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          runId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          userTickerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          status: "failed",
          attempts: 3,
          lastErrorCode: "resend_error",
          lastErrorMessage: "nope",
          errorCategory: "resend_error",
          resendEmailId: null,
        },
      ],
    } satisfies DeliveryRunDetailRow;

    const detail = mapRowToDetailItem(row);
    expect(detail.recipientsJson).toContain("failed");
    expect(detail.resendMessageIds).toBe('["a","b"]');
    expect(detail.agentId).toBe("delivery");
  });
});
