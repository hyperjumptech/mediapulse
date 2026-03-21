/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  callDomainCustomPost,
  getDomainTableMeta,
  invokeDomainTableCustomAction,
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
      key: "mediapulse",
      baseUrl: "http://localhost:3001",
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
