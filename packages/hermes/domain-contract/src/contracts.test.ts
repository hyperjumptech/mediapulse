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
      pages: [],
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
      template: "table-v1",
      apiPrefix: "/v1/hermes-dashboard/x",
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
      template: "table-v1",
      apiPrefix: "/v1/hermes-dashboard/x",
      createSchema,
    });

    // Assert
    expect(parsed.createSchema).toEqual(createSchema);
  });
});

describe("dashboardPageSchema", () => {
  it("defaults customActions on a page definition", () => {
    const parsed = dashboardPageSchema.parse({
      id: "tickers",
      label: "Tickers",
      pathSegment: "tickers",
      template: "table-v1",
      apiPrefix: "/v1/hermes-dashboard/tickers",
      columns: [],
    });

    expect(parsed.customActions).toEqual([]);
    expect(parsed.createNavigation).toBe("modal");
  });
});
