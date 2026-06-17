import { describe, expect, it } from "vitest";

import {
  contentViewResponseSchema,
  dashboardManifestSchema,
  dashboardViewSchema,
  normalizeLegacyDashboardView,
} from "./dashboard-views";

describe("dashboardViewSchema", () => {
  it("parses a resource-table sidebar view", () => {
    const parsed = dashboardViewSchema.parse({
      id: "tickers",
      label: "Tickers",
      kind: "resource-table",
      placement: "sidebar",
      pathSegment: "tickers",
      apiPrefix: "/v1/hermes-dashboard/tickers",
      createNavigation: "modal",
    });
    expect(parsed.kind).toBe("resource-table");
  });

  it("parses html agent-tab views", () => {
    const parsed = dashboardViewSchema.parse({
      id: "insights",
      label: "Insights",
      kind: "html",
      placement: "agent-tab",
      apiPrefix: "/v1/hermes-dashboard/content/agent-insights",
      agentIds: ["content-generation"],
    });
    expect(parsed.placement).toBe("agent-tab");
  });
});

describe("dashboardManifestSchema", () => {
  it("accepts legacy pages with template table-v1", () => {
    const parsed = dashboardManifestSchema.parse({
      templateVersion: 1,
      pages: [
        {
          id: "tickers",
          label: "Tickers",
          template: "table-v1",
          pathSegment: "tickers",
          apiPrefix: "/v1/hermes-dashboard/tickers",
          createNavigation: "modal",
        },
      ],
    });
    expect(parsed.views[0]?.kind).toBe("resource-table");
  });
});

describe("normalizeLegacyDashboardView", () => {
  it("maps template table-v1 to kind resource-table", () => {
    const normalized = normalizeLegacyDashboardView({
      id: "x",
      template: "table-v1",
    }) as Record<string, unknown>;
    expect(normalized.kind).toBe("resource-table");
    expect(normalized.template).toBeUndefined();
  });
});

describe("contentViewResponseSchema", () => {
  it("parses body payloads", () => {
    expect(
      contentViewResponseSchema.parse({ body: "<p>hi</p>", title: "T" }),
    ).toEqual({ body: "<p>hi</p>", title: "T" });
  });
});
