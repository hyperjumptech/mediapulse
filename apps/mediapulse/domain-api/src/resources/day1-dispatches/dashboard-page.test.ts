import { dashboardViewSchema } from "@hermes/domain-contract";
import { describe, expect, it } from "vitest";

import {
  day1DispatchesDashboardPage,
  day1DispatchKindBadgeTones,
  day1DispatchStatusBadgeTones,
} from "./dashboard-page";
import {
  DAY1_DISPATCH_KIND_LABELS,
  DAY1_DISPATCH_STATUS_LABELS,
} from "./list-mapper";

describe("day1DispatchesDashboardPage", () => {
  it("satisfies the Hermes dashboard view contract", () => {
    const parsed = dashboardViewSchema.safeParse(day1DispatchesDashboardPage);

    expect(parsed.success).toBe(true);
  });

  it("lists the ticker, subscriber, pipeline and outcome", () => {
    const keys = day1DispatchesDashboardPage.columns.map(
      (column) => column.key,
    );

    expect(keys).toEqual([
      "tickerSymbol",
      "subscriberEmail",
      "kind",
      "status",
      "reason",
      "language",
      "createdAt",
    ]);
  });

  it("gives every pipeline and status label a badge tone", () => {
    for (const label of Object.values(DAY1_DISPATCH_KIND_LABELS)) {
      expect(day1DispatchKindBadgeTones).toHaveProperty(label);
    }
    for (const label of Object.values(DAY1_DISPATCH_STATUS_LABELS)) {
      expect(day1DispatchStatusBadgeTones).toHaveProperty(label);
    }
  });

  it("links the Hermes run through the execution redirect", () => {
    const [detailBlock] = day1DispatchesDashboardPage.detailBlocks;
    const hermesRow = detailBlock?.rows.find(
      (row) => row.field === "hermesExecutionId",
    );

    expect(hermesRow).toMatchObject({
      linkTemplate: "/dashboard/executions/{hermesExecutionId}",
    });
  });

  it("filters by status and pipeline using the stored enum values", () => {
    const optionValues = (key: string) => {
      const filter = day1DispatchesDashboardPage.listFilters.find(
        (candidate) => candidate.key === key,
      );
      const staticOptions =
        filter && "staticOptions" in filter ? filter.staticOptions : [];

      return staticOptions.map((option) => option.value);
    };

    expect(optionValues("status")).toEqual([
      "dispatching",
      "fired",
      "failed",
      "skipped",
    ]);
    expect(optionValues("kind")).toEqual(["bootstrap", "latest_issue", "none"]);
  });
});
