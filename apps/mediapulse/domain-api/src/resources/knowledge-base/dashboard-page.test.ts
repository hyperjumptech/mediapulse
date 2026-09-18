/** @vitest-environment node */
import { dashboardViewSchema } from "@hermes/domain-contract";
import { describe, expect, it } from "vitest";

import { hermesDashboardResources } from "../../hermes-dashboard/hermes-dashboard-resource-registry";
import { knowledgeBaseDashboardPage } from "./dashboard-page";

describe("knowledgeBaseDashboardPage", () => {
  it("satisfies the Hermes dashboard view contract", () => {
    const parsed = dashboardViewSchema.safeParse(knowledgeBaseDashboardPage);

    expect(parsed.success).toBe(true);
  });

  it("is read-only with a detail page", () => {
    expect(knowledgeBaseDashboardPage.actions).toStrictEqual({
      create: false,
      update: false,
      delete: false,
      view: true,
    });
  });

  it("declares an overview, a graph and the evidence tabs, in that order", () => {
    const types = knowledgeBaseDashboardPage.detailBlocks?.map(
      (block) => block.type,
    );

    expect(types).toStrictEqual(["panel", "graph", "tabs"]);
  });

  it("binds the graph block to the payload's graph fields", () => {
    const graph = knowledgeBaseDashboardPage.detailBlocks?.find(
      (block) => block.type === "graph",
    );

    expect(graph).toMatchObject({
      nodesField: "graph.nodes",
      edgesField: "graph.edges",
      orientation: "horizontal",
    });
  });

  it("orders the sidebar entry the same way in both declarations", () => {
    const registered = hermesDashboardResources.find(
      (resource) => resource.resourceKey === "knowledgeBase",
    );

    expect(registered?.order).toBe(knowledgeBaseDashboardPage.order);
    expect(registered?.pathSegment).toBe(
      knowledgeBaseDashboardPage.pathSegment,
    );
  });
});
