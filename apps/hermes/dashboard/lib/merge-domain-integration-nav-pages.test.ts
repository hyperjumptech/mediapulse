/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { DomainIntegrationRecord } from "./domain-integrations";
import { mergeDomainIntegrationNavPages } from "./merge-domain-integration-nav-pages";

const baseIntegration = (): DomainIntegrationRecord => ({
  id: "i1",
  key: "mediapulse",
  name: "Mediapulse",
  baseUrl: "http://localhost:3001",
  version: null,
  dashboard: {
    templateVersion: 1,
    pages: [
      {
        id: "tickers",
        label: "Tickers",
        pathSegment: "tickers",
        template: "table-v1",
        apiPrefix: "/v1/hermes-dashboard/tickers",
        order: 10,
        columns: [],
        searchableFields: [],
        sortableFields: [],
        actions: { create: true, update: true, delete: true },
        customActions: [],
        createNavigation: "modal",
      },
    ],
  },
  capabilities: ["expand-step-inputs", "preview-expansion"],
});

describe("mergeDomainIntegrationNavPages", () => {
  it("appends synthetic data-source-expansions when capability matches and page absent", () => {
    const merged = mergeDomainIntegrationNavPages(baseIntegration());
    const segments = merged.map((p) => p.pathSegment);
    expect(segments).toContain("data-source-expansions");
    const ds = merged.find((p) => p.pathSegment === "data-source-expansions");
    expect(ds?.label).toBe("Data source expansions");
  });

  it("does not duplicate when manifest already includes the page", () => {
    const synthetic = mergeDomainIntegrationNavPages(baseIntegration()).find(
      (p) => p.pathSegment === "data-source-expansions",
    );
    if (!synthetic) throw new Error("expected synthetic");
    const integration = baseIntegration();
    integration.dashboard = {
      ...integration.dashboard,
      pages: [...integration.dashboard.pages, synthetic],
    };
    const merged = mergeDomainIntegrationNavPages(integration);
    expect(
      merged.filter((p) => p.pathSegment === "data-source-expansions"),
    ).toHaveLength(1);
  });

  it("does not append when expand-step-inputs is missing", () => {
    const integration = baseIntegration();
    integration.capabilities = ["preview-expansion"];
    const merged = mergeDomainIntegrationNavPages(integration);
    expect(merged.some((p) => p.pathSegment === "data-source-expansions")).toBe(
      false,
    );
  });
});
