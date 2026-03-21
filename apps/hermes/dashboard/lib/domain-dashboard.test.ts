/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDomainTableMeta } from "./domain-dashboard";

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
