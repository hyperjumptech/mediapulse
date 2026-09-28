import { dashboardViewSchema } from "@hermes/domain-contract";
import { describe, expect, it } from "vitest";

import { deliveryRunsDashboardPage } from "./dashboard-page";

const columnByKey = (key: string) =>
  deliveryRunsDashboardPage.columns.find((column) => column.key === key);

describe("deliveryRunsDashboardPage", () => {
  it("satisfies the Hermes dashboard view contract", () => {
    const parsed = dashboardViewSchema.safeParse(deliveryRunsDashboardPage);

    expect(parsed.success).toBe(true);
  });

  it("lists the run outcome, counts and timing in scan order", () => {
    const keys = deliveryRunsDashboardPage.columns.map((column) => column.key);

    expect(keys).toEqual([
      "tickerSymbol",
      "outcome",
      "successCount",
      "failureCount",
      "skippedCount",
      "durationMs",
      "runSkipReason",
      "recipientErrorSummary",
      "createdAt",
    ]);
  });

  it("keeps the job id searchable without showing it as a column", () => {
    const keys = deliveryRunsDashboardPage.columns.map((column) => column.key);

    expect(keys).not.toContain("jobId");
    expect(deliveryRunsDashboardPage.searchableFields).toContain("jobId");
  });

  it("renders the outcome as a toned badge", () => {
    expect(columnByKey("outcome")).toMatchObject({
      format: "badge",
      mobile: "badge",
      badgeTones: {
        success: "success",
        partial_success: "warning",
        failed: "failed",
        skipped: "muted",
        skipped_all_already_delivered: "muted",
      },
    });
  });

  it("formats the counts as numbers and the duration from milliseconds", () => {
    const countFormats = ["successCount", "failureCount", "skippedCount"].map(
      (key) => columnByKey(key)?.format,
    );

    expect(countFormats).toEqual(["number", "number", "number"]);
    expect(columnByKey("durationMs")).toMatchObject({
      label: "Duration",
      format: "duration-ms",
    });
  });

  it("hides the error summary on narrow screens", () => {
    expect(columnByKey("recipientErrorSummary")).toMatchObject({
      hideBelow: "lg",
      mobile: "hidden",
    });
  });
});
