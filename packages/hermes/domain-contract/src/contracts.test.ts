/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  dashboardObjectFormJsonSchema,
  dashboardObjectFormJsonSchemaForListRow,
  dashboardPageCustomActionSchema,
  dashboardPageSchema,
  registerDomainIntegrationRequestSchema,
  tableV1ListResponseSchema,
  tableV1MetaResponseSchema,
} from "./contracts";

describe("registerDomainIntegrationRequestSchema", () => {
  it("defaults dashboard manifest when omitted", () => {
    // Act
    const parsed = registerDomainIntegrationRequestSchema.parse({
      integrationId: "mediapulse",
      name: "Mediapulse",
      baseUrl: "https://domain.example",
      capabilities: [],
    });

    // Assert
    expect(parsed.dashboard).toEqual({
      templateVersion: 1,
      views: [],
    });
  });
});

describe("tableV1ListResponseSchema", () => {
  it("parses a valid table-v1 list payload", () => {
    // Act
    const parsed = tableV1ListResponseSchema.parse({
      items: [{ id: "1", name: "AAPL" }],
      total: 1,
      page: 1,
      pageSize: 15,
    });

    // Assert
    expect(parsed.total).toBe(1);
    expect(parsed.items).toHaveLength(1);
  });
});

describe("dashboardPageCustomActionSchema", () => {
  it("parses a valid custom action", () => {
    const parsed = dashboardPageCustomActionSchema.parse({
      id: "import-idx-json",
      label: "Import IDX JSON",
      description: "Upload IDX company profiles JSON",
      ui: "json-file-upload",
      method: "POST",
      path: "/import-idx-json",
      accept: ".json,application/json",
    });

    expect(parsed.id).toBe("import-idx-json");
    expect(parsed.path).toBe("/import-idx-json");
  });

  it("rejects path without leading slash", () => {
    expect(() =>
      dashboardPageCustomActionSchema.parse({
        id: "x",
        label: "X",
        ui: "json-file-upload",
        method: "POST",
        path: "no-leading-slash",
      }),
    ).toThrow();
  });
});

describe("tableV1MetaResponseSchema", () => {
  it("defaults customActions when omitted", () => {
    const parsed = tableV1MetaResponseSchema.parse({
      title: "Tickers",
      columns: [{ key: "symbol", label: "Symbol" }],
      actions: { create: true, update: false, delete: false },
    });

    expect(parsed.customActions).toEqual([]);
    expect(parsed.createNavigation).toBe("modal");
    expect(parsed.actions.view).toBe(false);
  });

  it("parses meta with customActions", () => {
    const parsed = tableV1MetaResponseSchema.parse({
      title: "Tickers",
      columns: [{ key: "symbol", label: "Symbol" }],
      actions: { create: true, update: true, delete: true },
      customActions: [
        {
          id: "import-idx-json",
          label: "Import",
          ui: "json-file-upload",
          method: "POST",
          path: "/import-idx-json",
        },
      ],
    });

    expect(parsed.customActions).toHaveLength(1);
    expect(parsed.customActions[0]?.id).toBe("import-idx-json");
  });

  it("parses full-page navigation and preview config", () => {
    const parsed = tableV1MetaResponseSchema.parse({
      title: "Expansions",
      columns: [{ key: "name", label: "Name" }],
      actions: { create: true, update: true, delete: true },
      createNavigation: "full-page",
      preview: { enabled: true, fieldKey: "expansionString" },
    });

    expect(parsed.createNavigation).toBe("full-page");
    expect(parsed.preview).toEqual({
      enabled: true,
      fieldKey: "expansionString",
    });
  });

  it("parses meta with view action for read-only detail", () => {
    const parsed = tableV1MetaResponseSchema.parse({
      title: "Data sources",
      columns: [{ key: "title", label: "Title" }],
      actions: {
        create: false,
        update: false,
        delete: false,
        view: true,
      },
    });

    expect(parsed.actions.view).toBe(true);
  });

  it("parses meta with manifest-declared filters and filterOptions", () => {
    const parsed = tableV1MetaResponseSchema.parse({
      title: "Search Queries",
      columns: [{ key: "text", label: "Search Query" }],
      actions: { create: false, update: false, delete: true },
      listFilters: [
        {
          key: "intent",
          label: "Intent",
          ui: "select",
          optionsMetaKey: "intentOptions",
        },
      ],
      filterOptions: {
        intentOptions: [{ value: "breaking", label: "breaking" }],
        sourceOptions: [{ value: "llm", label: "llm" }],
      },
    });

    expect(parsed.listFilters).toHaveLength(1);
    expect(parsed.filterOptions?.intentOptions).toEqual([
      { value: "breaking", label: "breaking" },
    ]);
  });

  it("parses meta with date-range list filter definitions", () => {
    const parsed = tableV1MetaResponseSchema.parse({
      title: "Data Sources",
      columns: [{ key: "title", label: "Title" }],
      actions: { create: false, update: false, delete: false, view: true },
      listFilters: [
        {
          key: "createdAt",
          label: "Created",
          ui: "date-range",
          rangeParams: { from: "from", to: "to" },
        },
      ],
      filterOptions: {
        collectionSourceOptions: [
          { value: "page-collection", label: "Page Collection" },
        ],
      },
    });

    expect(parsed.listFilters?.[0]?.ui).toBe("date-range");
    expect(parsed.filterOptions?.collectionSourceOptions).toHaveLength(1);
  });
});

describe("dashboardObjectFormJsonSchemaForListRow", () => {
  it("returns a createSchema value accepted by dashboardPageSchema", () => {
    // Setup
    type ListRow = { id: string; name: string; description: string };
    const createSchema = dashboardObjectFormJsonSchemaForListRow<ListRow>()({
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", title: "Name" },
        description: { type: "string", title: "Description" },
      },
    });

    // Act
    const parsed = dashboardPageSchema.parse({
      id: "x",
      label: "X",
      pathSegment: "x",
      kind: "resource-table",
      placement: "sidebar",
      apiPrefix: "/v1/hermes-dashboard/x",
      createNavigation: "modal",
      createSchema,
    });

    // Assert
    expect(parsed.createSchema).toEqual(createSchema);
  });
});

describe("dashboardObjectFormJsonSchema", () => {
  it("returns a createSchema value accepted by dashboardPageSchema", () => {
    // Setup
    const createSchema = dashboardObjectFormJsonSchema({
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", title: "Name" },
      },
    });

    // Act
    const parsed = dashboardPageSchema.parse({
      id: "x",
      label: "X",
      pathSegment: "x",
      kind: "resource-table",
      placement: "sidebar",
      apiPrefix: "/v1/hermes-dashboard/x",
      createNavigation: "modal",
      createSchema,
    });

    // Assert
    expect(parsed.createSchema).toEqual(createSchema);
  });
});

describe("dashboardPageSchema", () => {
  it("accepts a danger-confirm custom action with confirm fields", () => {
    const parsed = dashboardPageSchema.parse({
      id: "entity-relations",
      label: "Entity Relations",
      pathSegment: "entity-relations",
      kind: "resource-table",
      placement: "sidebar",
      apiPrefix: "/v1/hermes-dashboard/entity-relations",
      createNavigation: "modal",
      columns: [],
      customActions: [
        {
          id: "reset-all",
          label: "Reset all relations",
          ui: "danger-confirm",
          method: "POST",
          path: "/reset-all",
          confirmMessage: "Delete all?",
          confirmToken: "DELETE_ALL_ENTITY_RELATIONS",
        },
      ],
    });

    expect(parsed.customActions[0]?.ui).toBe("danger-confirm");
    expect(parsed.customActions[0]?.confirmToken).toBe(
      "DELETE_ALL_ENTITY_RELATIONS",
    );
  });

  it("defaults customActions on a page definition", () => {
    const parsed = dashboardPageSchema.parse({
      id: "tickers",
      label: "Tickers",
      pathSegment: "tickers",
      kind: "resource-table",
      placement: "sidebar",
      apiPrefix: "/v1/hermes-dashboard/tickers",
      createNavigation: "modal",
      columns: [],
    });

    expect(parsed.customActions).toEqual([]);
    expect(parsed.createNavigation).toBe("modal");
  });
});
