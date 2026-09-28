import { describe, expect, it } from "vitest";

import {
  contentViewResponseSchema,
  dashboardManifestSchema,
  dashboardPageColumnSchema,
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

describe("dashboardPageColumnSchema display hints", () => {
  it("keeps valid formats, tones, breakpoints and mobile roles", () => {
    const column = dashboardPageColumnSchema.parse({
      key: "outcome",
      label: "Outcome",
      format: "badge",
      badgeTones: { sent: "success", skipped: "muted" },
      hideBelow: "lg",
      mobile: "badge",
      defaultHidden: true,
    });

    expect(column).toMatchObject({
      format: "badge",
      badgeTones: { sent: "success", skipped: "muted" },
      hideBelow: "lg",
      mobile: "badge",
      defaultHidden: true,
    });
  });

  it("drops unknown hint values instead of failing the whole manifest", () => {
    const column = dashboardPageColumnSchema.parse({
      key: "outcome",
      label: "Outcome",
      format: "sparkline",
      badgeTones: { sent: "glowing" },
      hideBelow: "2xl",
      mobile: "hero",
      defaultHidden: "yes",
    });

    expect(column).toEqual({ key: "outcome", label: "Outcome", type: "text" });
  });

  it("leaves old columns unchanged", () => {
    expect(
      dashboardPageColumnSchema.parse({
        key: "createdAt",
        label: "Created",
        type: "date-time",
      }),
    ).toEqual({ key: "createdAt", label: "Created", type: "date-time" });
  });
});
