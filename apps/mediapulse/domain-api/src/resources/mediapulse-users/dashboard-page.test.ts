import { dashboardViewSchema } from "@hermes/domain-contract";
import { describe, expect, it } from "vitest";

import { mediapulseUsersDashboardPage } from "./dashboard-page";

const columnByKey = (key: string) =>
  mediapulseUsersDashboardPage.columns.find((column) => column.key === key);

describe("mediapulseUsersDashboardPage", () => {
  it("satisfies the Hermes dashboard view contract", () => {
    const parsed = dashboardViewSchema.safeParse(mediapulseUsersDashboardPage);

    expect(parsed.success).toBe(true);
  });

  it("enables the read-only detail view", () => {
    expect(mediapulseUsersDashboardPage.actions.view).toBe(true);
  });

  it("lists the subscriber, whether they are enabled and their languages", () => {
    const keys = mediapulseUsersDashboardPage.columns.map(
      (column) => column.key,
    );

    expect(keys).toEqual([
      "email",
      "name",
      "enabled",
      "languages",
      "createdAt",
    ]);
  });

  it("renders the enabled flag as a boolean and the name as the phone subtitle", () => {
    expect(columnByKey("enabled")?.format).toBe("boolean");
    expect(columnByKey("name")?.mobile).toBe("subtitle");
  });

  it("shows the user's name, status and sign-up date above their subscriptions", () => {
    const [user, subscriptionsBlock] =
      mediapulseUsersDashboardPage.detailBlocks ?? [];
    const userFields =
      user?.type === "keyValue" ? user.rows.map((row) => row.field) : [];

    expect(userFields).toEqual(["name", "enabled", "createdAt"]);
    expect(subscriptionsBlock).toMatchObject({
      label: "Subscriptions",
      type: "subTable",
      field: "subscriptions",
      emptyState: "No ticker subscriptions.",
    });
  });
});
