/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import type { DomainIntegrationRecord } from "./domain-integrations";
import { mergeDomainIntegrationNavPages } from "./merge-domain-integration-nav-pages";

const loadExtensionsMock = vi.fn();

vi.mock("./load-hermes-dashboard-extensions", () => ({
  loadHermesDashboardExtensions: () => loadExtensionsMock(),
}));

const baseIntegration = (): DomainIntegrationRecord => ({
  id: "i1",
  integrationId: "acme",
  name: "Acme",
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
        actions: { create: true, update: true, delete: true, view: false },
        customActions: [],
        createNavigation: "modal",
      },
    ],
  },
  capabilities: ["expand-step-inputs", "preview-expansion"],
});

describe("mergeDomainIntegrationNavPages", () => {
  it("appends synthetic data-source-expansions when capability matches and page absent", async () => {
    loadExtensionsMock.mockResolvedValue(null);
    const merged = await mergeDomainIntegrationNavPages(baseIntegration());
    const segments = merged.map((p) => p.pathSegment);
    expect(segments).toContain("data-source-expansions");
    const ds = merged.find((p) => p.pathSegment === "data-source-expansions");
    expect(ds?.label).toBe("Data source expansions");
  });

  it("does not duplicate when manifest already includes the page", async () => {
    loadExtensionsMock.mockResolvedValue(null);
    const synthetic = (
      await mergeDomainIntegrationNavPages(baseIntegration())
    ).find((p) => p.pathSegment === "data-source-expansions");
    if (!synthetic) throw new Error("expected synthetic");
    const integration = baseIntegration();
    integration.dashboard = {
      ...integration.dashboard,
      pages: [...integration.dashboard.pages, synthetic],
    };
    const merged = await mergeDomainIntegrationNavPages(integration);
    expect(
      merged.filter((p) => p.pathSegment === "data-source-expansions"),
    ).toHaveLength(1);
  });

  it("does not append when expand-step-inputs is missing", async () => {
    loadExtensionsMock.mockResolvedValue(null);
    const integration = baseIntegration();
    integration.capabilities = ["preview-expansion"];
    const merged = await mergeDomainIntegrationNavPages(integration);
    expect(merged.some((p) => p.pathSegment === "data-source-expansions")).toBe(
      false,
    );
  });

  it("appends operator diagnostics pages when capability is registered and extensions load", async () => {
    loadExtensionsMock.mockResolvedValue({
      buildOperatorDiagnosticsNavPages: () => [
        {
          id: "operator-section-coverage",
          label: "Section coverage",
          pathSegment: "diagnostics/section-coverage",
          template: "table-v1",
          apiPrefix: "/diagnostics/section-coverage",
          order: 910,
          columns: [],
          searchableFields: [],
          sortableFields: [],
          actions: {
            create: false,
            update: false,
            delete: false,
            view: false,
          },
          customActions: [],
          createNavigation: "full-page",
        },
        {
          id: "operator-cga-diagnostics",
          label: "CGA diagnostics",
          pathSegment: "diagnostics/content-generation-runs",
          template: "table-v1",
          apiPrefix: "/diagnostics/content-generation-runs",
          order: 920,
          columns: [],
          searchableFields: [],
          sortableFields: [],
          actions: {
            create: false,
            update: false,
            delete: false,
            view: false,
          },
          customActions: [],
          createNavigation: "full-page",
        },
      ],
    });
    const integration = baseIntegration();
    integration.capabilities = [
      "expand-step-inputs",
      "preview-expansion",
      "operator-diagnostics",
    ];
    const merged = await mergeDomainIntegrationNavPages(integration);
    expect(
      merged.some(
        (p) => p.pathSegment === "diagnostics/content-generation-runs",
      ),
    ).toBe(true);
    expect(
      merged.some((p) => p.pathSegment === "diagnostics/section-coverage"),
    ).toBe(true);
  });
});
