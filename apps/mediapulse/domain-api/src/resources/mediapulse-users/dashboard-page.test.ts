import { describe, expect, it } from "vitest";

import { mediapulseUsersDashboardPage } from "./dashboard-page";

describe("mediapulseUsersDashboardPage", () => {
  it("enables the read-only detail view", () => {
    expect(mediapulseUsersDashboardPage.actions.view).toBe(true);
  });

  it("declares user metadata and subscriptions detail blocks", () => {
    const labels = mediapulseUsersDashboardPage.detailBlocks?.map(
      (block) => block.label,
    );

    expect(labels).toEqual(["User", "Subscriptions"]);

    const subscriptions = mediapulseUsersDashboardPage.detailBlocks?.find(
      (block) => block.label === "Subscriptions",
    );
    expect(subscriptions).toMatchObject({
      type: "subTable",
      field: "subscriptions",
      emptyState: "No ticker subscriptions.",
    });
  });
});
