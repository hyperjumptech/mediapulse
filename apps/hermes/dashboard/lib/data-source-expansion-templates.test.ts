/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDataSourceExpansionTemplateForIntegration,
  deleteDataSourceExpansionTemplateForIntegration,
  getDataSourceExpansionTemplateByIdForIntegration,
  getDataSourceExpansionTemplateByIdWithUsageForIntegration,
  listDataSourceExpansionTemplatesForIntegration,
  mapDataSourceExpansionTemplateRowToListItem,
  updateDataSourceExpansionTemplateForIntegration,
} from "./data-source-expansion-templates";
import { integrationSupportsHermesDataSourceExpansionTemplates } from "./data-source-expansion-template-capabilities";

const integrationId = "i1";

const mockGetDomainIntegrationByKey = vi.fn();

vi.mock("@/lib/domain-integrations", () => ({
  getDomainIntegrationByKey: (...args: unknown[]) =>
    mockGetDomainIntegrationByKey(...args),
}));

const mockGetSession = vi.fn();

vi.mock("@/lib/auth-dashboard", () => ({
  getDashboardSession: (...args: unknown[]) => mockGetSession(...args),
}));

describe("integrationSupportsHermesDataSourceExpansionTemplates", () => {
  it("returns true when expand-step-inputs is present", () => {
    expect(
      integrationSupportsHermesDataSourceExpansionTemplates([
        "expand-step-inputs",
      ]),
    ).toBe(true);
  });

  it("returns false when capability is missing", () => {
    expect(
      integrationSupportsHermesDataSourceExpansionTemplates([
        "preview-expansion",
      ]),
    ).toBe(false);
  });
});

describe("mapDataSourceExpansionTemplateRowToListItem", () => {
  it("maps dates to ISO strings", () => {
    const d = new Date("2025-01-01T00:00:00.000Z");
    const row = {
      id: "t1",
      name: "n",
      expansionString: "db:a:b",
      description: null,
      createdAt: d,
      updatedAt: d,
    };
    expect(mapDataSourceExpansionTemplateRowToListItem(row)).toEqual({
      id: "t1",
      name: "n",
      expansionString: "db:a:b",
      description: null,
      createdAt: d.toISOString(),
      updatedAt: d.toISOString(),
    });
  });
});

describe("listDataSourceExpansionTemplatesForIntegration", () => {
  beforeEach(() => {
    mockGetDomainIntegrationByKey.mockResolvedValue({
      id: integrationId,
      key: "mediapulse",
      name: "Mediapulse",
      baseUrl: "http://localhost",
      version: null,
      dashboard: { templateVersion: 1, pages: [] },
      capabilities: ["expand-step-inputs"],
    });
  });

  afterEach(() => {
    mockGetDomainIntegrationByKey.mockReset();
  });

  it("returns paginated list items", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "a",
        name: "Alpha",
        expansionString: "db:t:id",
        description: null,
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        updatedAt: new Date("2025-01-01T00:00:00.000Z"),
      },
    ]);
    const count = vi.fn().mockResolvedValue(1);

    const result = await listDataSourceExpansionTemplatesForIntegration(
      "mediapulse",
      {
        page: 1,
        pageSize: 10,
        sortBy: "name",
        sortDir: "asc",
      },
      {
        db: {
          findMany,
          count,
        } as unknown as import("./data-source-expansion-templates").DataSourceExpansionTemplateDelegate,
      },
    );

    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.name).toBe("Alpha");
    expect(findMany).toHaveBeenCalled();
    expect(count).toHaveBeenCalled();
  });
});

describe("getDataSourceExpansionTemplateByIdForIntegration", () => {
  beforeEach(() => {
    mockGetDomainIntegrationByKey.mockResolvedValue({
      id: integrationId,
      key: "mediapulse",
      name: "Mediapulse",
      baseUrl: "http://localhost",
      version: null,
      dashboard: { templateVersion: 1, pages: [] },
      capabilities: ["expand-step-inputs"],
    });
  });

  afterEach(() => {
    mockGetDomainIntegrationByKey.mockReset();
  });

  it("returns null when row is missing", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);

    const result = await getDataSourceExpansionTemplateByIdForIntegration(
      "mediapulse",
      "missing",
      {
        db: {
          findFirst,
        } as unknown as import("./data-source-expansion-templates").DataSourceExpansionTemplateDelegate,
      },
    );

    expect(result).toBeNull();
  });
});

describe("getDataSourceExpansionTemplateByIdWithUsageForIntegration", () => {
  beforeEach(() => {
    mockGetDomainIntegrationByKey.mockResolvedValue({
      id: integrationId,
      key: "mediapulse",
      name: "Mediapulse",
      baseUrl: "http://localhost",
      version: null,
      dashboard: { templateVersion: 1, pages: [] },
      capabilities: ["expand-step-inputs"],
    });
  });

  afterEach(() => {
    mockGetDomainIntegrationByKey.mockReset();
  });

  it("returns template row and pipeline usage", async () => {
    // Setup
    const findFirst = vi.fn().mockResolvedValue({
      id: "tpl-1",
      name: "Ticker IDs",
      expansionString: "db:ticker:id",
      description: "Ticker list",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-01T00:00:00.000Z"),
    });
    const getUsage = vi.fn().mockResolvedValue([
      {
        id: "pipeline-1",
        name: "Pipeline 1",
        matchCount: 2,
        matchedStepIds: ["step-1"],
      },
    ]);

    // Act
    const result =
      await getDataSourceExpansionTemplateByIdWithUsageForIntegration(
        "mediapulse",
        "tpl-1",
        {
          db: {
            findFirst,
          } as unknown as import("./data-source-expansion-templates").DataSourceExpansionTemplateDelegate,
          getUsage,
        },
      );

    // Assert
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tpl-1", domainIntegrationId: integrationId },
      }),
    );
    expect(getUsage).toHaveBeenCalledWith(integrationId, "db:ticker:id");
    expect(result).toEqual({
      template: {
        id: "tpl-1",
        name: "Ticker IDs",
        expansionString: "db:ticker:id",
        description: "Ticker list",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
      usage: [
        {
          id: "pipeline-1",
          name: "Pipeline 1",
          matchCount: 2,
          matchedStepIds: ["step-1"],
        },
      ],
    });
  });
});

describe("createDataSourceExpansionTemplateForIntegration", () => {
  beforeEach(() => {
    mockGetDomainIntegrationByKey.mockResolvedValue({
      id: integrationId,
      key: "mediapulse",
      name: "Mediapulse",
      baseUrl: "http://localhost",
      version: null,
      dashboard: { templateVersion: 1, pages: [] },
      capabilities: ["expand-step-inputs"],
    });
    mockGetSession.mockResolvedValue({ id: "u1", name: "A", email: "a@b.c" });
  });

  afterEach(() => {
    mockGetDomainIntegrationByKey.mockReset();
    mockGetSession.mockReset();
  });

  it("creates a row and returns id", async () => {
    const create = vi.fn().mockResolvedValue({ id: "new-id" });

    const result = await createDataSourceExpansionTemplateForIntegration(
      "mediapulse",
      {
        name: "x",
        expansionString: "db:t:id",
        description: null,
      },
      {
        db: {
          create,
        } as unknown as import("./data-source-expansion-templates").DataSourceExpansionTemplateDelegate,
        getSession: mockGetSession,
      },
    );

    expect(result.id).toBe("new-id");
    expect(create).toHaveBeenCalled();
  });
});

describe("updateDataSourceExpansionTemplateForIntegration", () => {
  beforeEach(() => {
    mockGetDomainIntegrationByKey.mockResolvedValue({
      id: integrationId,
      key: "mediapulse",
      name: "Mediapulse",
      baseUrl: "http://localhost",
      version: null,
      dashboard: { templateVersion: 1, pages: [] },
      capabilities: ["expand-step-inputs"],
    });
  });

  afterEach(() => {
    mockGetDomainIntegrationByKey.mockReset();
  });

  it("throws when no row matches", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });

    await expect(
      updateDataSourceExpansionTemplateForIntegration(
        "mediapulse",
        "id1",
        { name: "x", expansionString: "db:a:b", description: null },
        {
          db: {
            updateMany,
          } as unknown as import("./data-source-expansion-templates").DataSourceExpansionTemplateDelegate,
        },
      ),
    ).rejects.toThrow("Domain dashboard request failed (404)");
  });
});

describe("deleteDataSourceExpansionTemplateForIntegration", () => {
  beforeEach(() => {
    mockGetDomainIntegrationByKey.mockResolvedValue({
      id: integrationId,
      key: "mediapulse",
      name: "Mediapulse",
      baseUrl: "http://localhost",
      version: null,
      dashboard: { templateVersion: 1, pages: [] },
      capabilities: ["expand-step-inputs"],
    });
  });

  afterEach(() => {
    mockGetDomainIntegrationByKey.mockReset();
  });

  it("throws when no row matches", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });

    await expect(
      deleteDataSourceExpansionTemplateForIntegration("mediapulse", "id1", {
        db: {
          deleteMany,
        } as unknown as import("./data-source-expansion-templates").DataSourceExpansionTemplateDelegate,
      }),
    ).rejects.toThrow("Domain dashboard request failed (404)");
  });
});
