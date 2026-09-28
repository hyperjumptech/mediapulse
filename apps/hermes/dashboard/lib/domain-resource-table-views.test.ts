/** @vitest-environment node */
import { dashboardManifestSchema } from "@hermes/domain-contract";
import { describe, expect, it } from "vitest";

import type { DomainIntegrationRecord } from "./domain-integrations";
import {
  domainTableFilterQueryKeys,
  findDomainResourceTableView,
  listDomainResourceTableViews,
  toDomainResourceTableViewSummary,
} from "./domain-resource-table-views";

const buildIntegration = (
  capabilities: DomainIntegrationRecord["capabilities"] = ["preview-expansion"],
): DomainIntegrationRecord => ({
  id: "i1",
  integrationId: "acme",
  name: "Acme",
  baseUrl: "http://localhost:3001",
  version: null,
  dashboard: dashboardManifestSchema.parse({
    views: [
      {
        id: "orders",
        label: "Orders",
        description: "Customer orders",
        kind: "resource-table",
        pathSegment: "orders",
        apiPrefix: "/v1/orders",
        order: 10,
        columns: [
          { key: "reference", label: "Reference" },
          { key: "createdAt", label: "Created", type: "date-time" },
          { key: "total", label: "Total", format: "number" },
        ],
        searchableFields: ["reference"],
        sortableFields: ["reference", "createdAt"],
        defaultSort: { sortBy: "createdAt", sortDir: "desc" },
        listFilters: [
          {
            key: "status",
            label: "Status",
            ui: "select",
            staticOptions: [{ value: "open", label: "Open" }],
          },
          {
            key: "created",
            label: "Created",
            ui: "date-range",
            rangeParams: { from: "createdFrom", to: "createdTo" },
          },
        ],
      },
      {
        id: "readme",
        label: "Readme",
        kind: "markdown",
        pathSegment: "readme",
        apiPrefix: "/v1/readme",
      },
    ],
  }),
  capabilities,
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

describe("listDomainResourceTableViews", () => {
  it("keeps resource-table views only", () => {
    const views = listDomainResourceTableViews(buildIntegration());

    expect(views.map((view) => view.pathSegment)).toEqual(["orders"]);
  });

  it("includes the Hermes data source expansions view when supported", () => {
    const views = listDomainResourceTableViews(
      buildIntegration(["expand-step-inputs"]),
    );

    expect(views.map((view) => view.pathSegment)).toEqual([
      "orders",
      "data-source-expansions",
    ]);
  });
});

describe("findDomainResourceTableView", () => {
  it("finds a resource-table view by path segment", () => {
    expect(findDomainResourceTableView(buildIntegration(), "orders")?.id).toBe(
      "orders",
    );
  });

  it("ignores content views and unknown segments", () => {
    const integration = buildIntegration();

    expect(findDomainResourceTableView(integration, "readme")).toBeUndefined();
    expect(findDomainResourceTableView(integration, "missing")).toBeUndefined();
  });
});

describe("domainTableFilterQueryKeys", () => {
  it("returns the filter key for select filters", () => {
    expect(
      domainTableFilterQueryKeys({
        key: "status",
        label: "Status",
        ui: "select",
        staticOptions: [],
      }),
    ).toEqual(["status"]);
  });

  it("returns both range params for date-range filters", () => {
    expect(
      domainTableFilterQueryKeys({
        key: "created",
        label: "Created",
        ui: "date-range",
      }),
    ).toEqual(["from", "to"]);
  });
});

describe("toDomainResourceTableViewSummary", () => {
  it("summarizes columns, search, sort, and filters", () => {
    const view = findDomainResourceTableView(buildIntegration(), "orders");
    if (!view) {
      throw new Error("expected orders view");
    }

    const summary = toDomainResourceTableViewSummary(view);

    expect(summary).toEqual({
      id: "orders",
      label: "Orders",
      description: "Customer orders",
      pathSegment: "orders",
      columns: [
        { key: "reference", label: "Reference", format: "text" },
        { key: "createdAt", label: "Created", format: "date-time" },
        { key: "total", label: "Total", format: "number" },
      ],
      searchableFields: ["reference"],
      sortableFields: ["reference", "createdAt"],
      defaultSort: { sortBy: "createdAt", sortDir: "desc" },
      filters: [
        {
          key: "status",
          label: "Status",
          ui: "select",
          queryKeys: ["status"],
          options: [{ value: "open", label: "Open" }],
        },
        {
          key: "created",
          label: "Created",
          ui: "date-range",
          queryKeys: ["createdFrom", "createdTo"],
        },
      ],
    });
  });
});
