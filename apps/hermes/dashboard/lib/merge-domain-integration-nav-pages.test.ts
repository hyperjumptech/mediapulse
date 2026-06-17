/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { DomainIntegrationRecord } from "./domain-integrations";
import { mergeDomainIntegrationNavViews } from "./merge-domain-integration-nav-pages";

const baseIntegration = (): DomainIntegrationRecord => ({
  id: "i1",
  integrationId: "acme",
  name: "Acme",
  baseUrl: "http://localhost:3001",
  version: null,
  dashboard: {
    templateVersion: 1,
    views: [
      {
        id: "tickers",
        label: "Tickers",
        kind: "resource-table",
        placement: "sidebar",
        pathSegment: "tickers",
        apiPrefix: "/v1/hermes-dashboard/tickers",
        order: 10,
        columns: [],
        searchableFields: [],
        sortableFields: [],
        actions: { create: true, update: true, delete: true, view: false },
        customActions: [],
        createNavigation: "modal",
      },
    ],
  },
  capabilities: ["expand-step-inputs", "preview-expansion"],
});

describe("mergeDomainIntegrationNavViews", () => {
  it("appends synthetic data-source-expansions when capability matches and view absent", () => {
    const merged = mergeDomainIntegrationNavViews(baseIntegration());
    const segments = merged.map((view) => view.pathSegment);
    expect(segments).toContain("data-source-expansions");
  });

  it("does not duplicate when manifest already includes the view", () => {
    const synthetic = mergeDomainIntegrationNavViews(baseIntegration()).find(
      (view) => view.pathSegment === "data-source-expansions",
    );
    if (!synthetic) throw new Error("expected synthetic");
    const integration = baseIntegration();
    integration.dashboard = {
      ...integration.dashboard,
      views: [...integration.dashboard.views, synthetic],
    };
    const merged = mergeDomainIntegrationNavViews(integration);
    expect(
      merged.filter((view) => view.pathSegment === "data-source-expansions"),
    ).toHaveLength(1);
  });

  it("does not append when expand-step-inputs is missing", () => {
    const integration = baseIntegration();
    integration.capabilities = ["preview-expansion"];
    const merged = mergeDomainIntegrationNavViews(integration);
    expect(
      merged.some((view) => view.pathSegment === "data-source-expansions"),
    ).toBe(false);
  });

  it("only returns sidebar views", () => {
    const integration = baseIntegration();
    integration.dashboard.views.push({
      id: "insights",
      label: "Insights",
      kind: "html",
      placement: "agent-tab",
      apiPrefix: "/v1/hermes-dashboard/content/agent-insights",
      order: 5,
    });
    const merged = mergeDomainIntegrationNavViews(integration);
    expect(merged.every((view) => view.placement === "sidebar")).toBe(true);
  });
});
