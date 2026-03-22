/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  callDomainCustomPost,
  fetchAllTickersForPipelineRun,
  getDomainTableItemById,
  getDomainTableMeta,
  invokeDomainTableCustomAction,
  previewDomainExpansion,
} from "./domain-dashboard";

const getDomainIntegrationByKey = vi.fn();

vi.mock("@/lib/domain-integrations", () => ({
  getDomainIntegrationByKey: (...args: unknown[]) =>
    getDomainIntegrationByKey(...args),
}));

describe("getDomainTableMeta", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    getDomainIntegrationByKey.mockReset();
  });

  it("loads meta from domain integration HTTP", async () => {
    getDomainIntegrationByKey.mockResolvedValue({
      id: "i1",
      key: "mediapulse",
      name: "Mediapulse",
      baseUrl: "http://localhost:3001",
      version: "1",
      capabilities: ["expand-step-inputs", "preview-expansion"],
      dashboard: {
        templateVersion: 1,
        pages: [
          {
            id: "tickers",
            label: "Tickers",
            pathSegment: "tickers",
            template: "table-v1",
            apiPrefix: "/v1/hermes-dashboard/tickers",
            columns: [],
            searchableFields: [],
            sortableFields: [],
            actions: { create: true, update: true, delete: true },
            order: 0,
          },
        ],
      },
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: "Tickers",
        description: "List",
        columns: [{ key: "symbol", label: "Symbol", type: "text" }],
        searchableFields: [],
        sortableFields: [],
        actions: { create: true, update: true, delete: true },
        createNavigation: "modal",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const meta = await getDomainTableMeta("mediapulse", "tickers");

    expect(getDomainIntegrationByKey).toHaveBeenCalledWith("mediapulse");
    expect(fetchMock).toHaveBeenCalled();
    expect(meta.title).toBe("Tickers");
  });

  it("throws when integration is missing", async () => {
    getDomainIntegrationByKey.mockResolvedValue(null);

    await expect(getDomainTableMeta("missing", "tickers")).rejects.toThrow(
      'Domain integration "missing"',
    );
  });
});

describe("callDomainCustomPost", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns data on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ added: 1, updated: 0 }),
    });
    const result = await callDomainCustomPost(
      "http://localhost/v1/x",
      { payloadJson: "{}" },
      fetchMock,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ added: 1, updated: 0 });
    }
  });

  it("returns message from error JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: "Invalid IDX payload" }),
    });
    const result = await callDomainCustomPost(
      "http://localhost/v1/x",
      { payloadJson: "{}" },
      fetchMock,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("Invalid IDX payload");
    }
  });

  it("returns generic message when error body has no message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    const result = await callDomainCustomPost(
      "http://localhost/v1/x",
      { payloadJson: "{}" },
      fetchMock,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("500");
    }
  });
});

describe("invokeDomainTableCustomAction", () => {
  it("returns error when action id is unknown", async () => {
    const getMeta = vi.fn().mockResolvedValue({
      title: "T",
      columns: [],
      searchableFields: [],
      sortableFields: [],
      actions: { create: false, update: false, delete: false },
      customActions: [],
    });

    const result = await invokeDomainTableCustomAction(
      "k",
      "tickers",
      "missing",
      "{}",
      { getMeta },
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toBe("Unknown custom action");
    }
  });

  it("returns error when action ui is not json-file-upload", async () => {
    const getMeta = vi.fn().mockResolvedValue({
      title: "T",
      columns: [],
      searchableFields: [],
      sortableFields: [],
      actions: { create: false, update: false, delete: false },
      customActions: [
        {
          id: "x",
          label: "X",
          ui: "json-file-upload",
          method: "GET",
          path: "/x",
        },
      ],
    });

    const result = await invokeDomainTableCustomAction(
      "k",
      "tickers",
      "x",
      "{}",
      {
        getMeta,
      },
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toBe("Unsupported custom action");
    }
  });

  it("posts payload and returns success data", async () => {
    const getMeta = vi.fn().mockResolvedValue({
      title: "T",
      columns: [],
      searchableFields: [],
      sortableFields: [],
      actions: { create: false, update: false, delete: false },
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
    const getPage = vi.fn().mockResolvedValue({
      page: {
        apiPrefix: "/v1/hermes-dashboard/tickers",
        pathSegment: "tickers",
      },
      baseUrl: "http://localhost",
    });
    const callPost = vi.fn().mockResolvedValue({
      ok: true,
      data: { added: 2, updated: 1 },
    });

    const result = await invokeDomainTableCustomAction(
      "k",
      "tickers",
      "import-idx-json",
      '{"data":[]}',
      { getMeta, getPage, callPost },
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ added: 2, updated: 1 });
    }
    expect(callPost).toHaveBeenCalledWith(
      "http://localhost/v1/hermes-dashboard/tickers/import-idx-json",
      { payloadJson: '{"data":[]}' },
    );
  });
});

describe("getDomainTableItemById", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    getDomainIntegrationByKey.mockReset();
  });

  it("returns null when domain responds 404", async () => {
    getDomainIntegrationByKey.mockResolvedValue({
      id: "i1",
      key: "mediapulse",
      name: "M",
      baseUrl: "http://localhost:3001",
      version: "1",
      capabilities: ["preview-expansion", "expand-step-inputs"],
      dashboard: {
        templateVersion: 1,
        pages: [
          {
            id: "tickers",
            label: "Tickers",
            pathSegment: "tickers",
            template: "table-v1",
            apiPrefix: "/v1/hermes-dashboard/tickers",
            columns: [],
            searchableFields: [],
            sortableFields: [],
            actions: { create: true, update: true, delete: true },
            order: 0,
          },
        ],
      },
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const row = await getDomainTableItemById(
      "mediapulse",
      "tickers",
      "missing",
    );

    expect(row).toBeNull();
  });

  it("returns parsed row on success", async () => {
    getDomainIntegrationByKey.mockResolvedValue({
      id: "i1",
      key: "mediapulse",
      name: "M",
      baseUrl: "http://localhost:3001",
      version: "1",
      capabilities: ["preview-expansion", "expand-step-inputs"],
      dashboard: {
        templateVersion: 1,
        pages: [
          {
            id: "tickers",
            label: "Tickers",
            pathSegment: "tickers",
            template: "table-v1",
            apiPrefix: "/v1/hermes-dashboard/tickers",
            columns: [],
            searchableFields: [],
            sortableFields: [],
            actions: { create: true, update: true, delete: true },
            order: 0,
          },
        ],
      },
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "a1", name: "Row" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const row = await getDomainTableItemById("mediapulse", "tickers", "a1");

    expect(row).toEqual({ id: "a1", name: "Row" });
  });
});

describe("previewDomainExpansion", () => {
  it("throws when integration lacks preview-expansion capability", async () => {
    const getIntegration = vi.fn().mockResolvedValue({
      id: "i1",
      key: "k",
      name: "N",
      baseUrl: "http://localhost",
      version: null,
      capabilities: ["expand-step-inputs"],
      dashboard: { templateVersion: 1, pages: [] },
    });

    await expect(
      previewDomainExpansion("k", "db:ticker:id", { getIntegration }),
    ).rejects.toThrow("does not support preview-expansion");
  });

  it("returns preview from domain client", async () => {
    const previewExpansion = vi
      .fn()
      .mockResolvedValue({ success: true, values: ["x"] });
    const createClient = vi.fn().mockReturnValue({ previewExpansion });
    const getIntegration = vi.fn().mockResolvedValue({
      id: "i1",
      key: "k",
      name: "N",
      baseUrl: "http://localhost",
      version: null,
      capabilities: ["preview-expansion"],
      dashboard: { templateVersion: 1, pages: [] },
    });

    const result = await previewDomainExpansion("k", "db:ticker:id", {
      getIntegration,
      createClient,
    });

    expect(result).toEqual({ success: true, values: ["x"] });
    expect(previewExpansion).toHaveBeenCalledWith({
      expansionString: "db:ticker:id",
    });
  });
});

describe("fetchAllTickersForPipelineRun", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    getDomainIntegrationByKey.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws when mediapulse domain integration is not registered", async () => {
    getDomainIntegrationByKey.mockResolvedValue(null);

    await expect(fetchAllTickersForPipelineRun()).rejects.toThrow(
      'Domain integration "mediapulse"',
    );
  });

  const injectedResolve = async () => ({
    baseUrl: "http://localhost:8090",
    apiPrefix: "/v1/hermes-dashboard/tickers",
  });

  it("returns string ids from a single page", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ id: "a1", symbol: "AAA" }, { id: "a2" }],
        total: 2,
        page: 1,
        pageSize: 100,
      }),
    });

    const result = await fetchAllTickersForPipelineRun({
      resolveUrl: injectedResolve,
    });

    expect(result).toEqual([{ id: "a1" }, { id: "a2" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("paginates until the reported total is covered", async () => {
    let page = 0;
    fetchMock.mockImplementation(async () => {
      page += 1;
      if (page === 1) {
        return {
          ok: true,
          json: async () => ({
            items: Array.from({ length: 100 }, (_, i) => ({ id: `id-${i}` })),
            total: 150,
            page: 1,
            pageSize: 100,
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          items: Array.from({ length: 50 }, (_, i) => ({
            id: `id-${100 + i}`,
          })),
          total: 150,
          page: 2,
          pageSize: 100,
        }),
      };
    });

    const result = await fetchAllTickersForPipelineRun({
      resolveUrl: injectedResolve,
    });

    expect(result).toHaveLength(150);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("skips items without a string id", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ id: 1 }, { id: "bad" }, { symbol: "x" }],
        total: 3,
        page: 1,
        pageSize: 100,
      }),
    });

    const result = await fetchAllTickersForPipelineRun({
      resolveUrl: injectedResolve,
    });

    expect(result).toEqual([{ id: "bad" }]);
  });

  it("returns empty when the first page has no rows", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        total: 0,
        page: 1,
        pageSize: 100,
      }),
    });

    const result = await fetchAllTickersForPipelineRun({
      resolveUrl: injectedResolve,
    });

    expect(result).toEqual([]);
  });
});
