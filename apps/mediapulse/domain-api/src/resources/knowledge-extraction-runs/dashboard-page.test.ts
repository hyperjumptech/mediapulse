import { dashboardViewSchema } from "@hermes/domain-contract";
import { describe, expect, it } from "vitest";

import { hermesDashboardResources } from "../../hermes-dashboard/hermes-dashboard-resource-registry";
import { knowledgeExtractionRunsDashboardPage } from "./dashboard-page";

describe("knowledgeExtractionRunsDashboardPage", () => {
  it("satisfies the Hermes dashboard view contract", () => {
    expect(
      dashboardViewSchema.safeParse(knowledgeExtractionRunsDashboardPage)
        .success,
    ).toBe(true);
  });

  it("is read-only with a detail page", () => {
    expect(knowledgeExtractionRunsDashboardPage.actions).toStrictEqual({
      create: false,
      update: false,
      delete: false,
      view: true,
    });
  });

  it("puts the refused share on the list, not only the detail page", () => {
    const keys = knowledgeExtractionRunsDashboardPage.columns.map(
      (column) => column.key,
    );

    expect(keys).toContain("rejectionRate");
    expect(keys).toContain("kindsCreated");
  });

  it("renders the run status as a toned badge on every screen", () => {
    const status = knowledgeExtractionRunsDashboardPage.columns.find(
      (column) => column.key === "status",
    );

    expect(status).toMatchObject({
      format: "badge",
      mobile: "badge",
      badgeTones: {
        running: "progress",
        success: "success",
        partial_success: "warning",
        failed: "failed",
      },
    });
  });

  it("formats the run counters as numbers", () => {
    const counterKeys = [
      "considered",
      "entitiesCreated",
      "mentionsWritten",
      "kindsCreated",
    ];
    const formats = knowledgeExtractionRunsDashboardPage.columns
      .filter((column) => counterKeys.includes(column.key))
      .map((column) => column.format);

    expect(formats).toEqual(["number", "number", "number", "number"]);
  });

  it("colours the refused stat card from the payload", () => {
    const panel = knowledgeExtractionRunsDashboardPage.detailBlocks?.[0];
    const cards =
      panel?.type === "panel" && panel.blocks[0]?.type === "statCards"
        ? panel.blocks[0].cards
        : [];

    expect(cards).toContainEqual(
      expect.objectContaining({ colorField: "header.rejectionVariant" }),
    );
  });

  it("is registered with a matching order", () => {
    const registered = hermesDashboardResources.find(
      (resource) => resource.resourceKey === "knowledgeExtractionRuns",
    );

    expect(registered?.order).toBe(knowledgeExtractionRunsDashboardPage.order);
    expect(registered?.pathSegment).toBe(
      knowledgeExtractionRunsDashboardPage.pathSegment,
    );
  });
});
