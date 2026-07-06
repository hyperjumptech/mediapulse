/** @vitest-environment node */
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {},
}));

vi.mock("./search-query-yield.js", () => ({
  getQueryYieldSummary: vi.fn().mockResolvedValue({
    perIntent: [],
    perPersona: [],
  }),
}));

const TICKER_ID = "11111111-1111-4111-a111-111111111111";

let getQueryAnalysisContext: typeof import("./query-analysis.js").getQueryAnalysisContext;

beforeAll(async () => {
  ({ getQueryAnalysisContext } = await import("./query-analysis.js"));
});

describe("getQueryAnalysisContext", () => {
  it("returns only the ticker with its classification columns", async () => {
    const findUniqueOrThrow = vi.fn().mockResolvedValue({
      id: TICKER_ID,
      symbol: "ACME",
      name: "Acme Co",
      sector: "Technology",
      industry: "Software",
      subSector: "Application Software",
      subIndustry: "SaaS",
      businessActivity: "Enterprise software",
    });
    const db = {
      ticker: { findUniqueOrThrow },
      searchQuerySet: {
        updateMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
      searchQuery: { deleteMany: vi.fn(), createMany: vi.fn() },
    };

    const payload = await getQueryAnalysisContext({ tickerId: TICKER_ID }, db);

    expect(payload).toEqual({
      ticker: {
        id: TICKER_ID,
        symbol: "ACME",
        name: "Acme Co",
        sector: "Technology",
        industry: "Software",
        subSector: "Application Software",
        subIndustry: "SaaS",
        businessActivity: "Enterprise software",
      },
    });
    expect(findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TICKER_ID } }),
    );
  });

  it("passes through null classification columns unchanged", async () => {
    const db = {
      ticker: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: TICKER_ID,
          symbol: "ACME",
          name: "Acme Co",
          sector: null,
          industry: null,
          subSector: null,
          subIndustry: null,
          businessActivity: null,
        }),
      },
      searchQuerySet: {
        updateMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
      searchQuery: { deleteMany: vi.fn(), createMany: vi.fn() },
    };

    const payload = await getQueryAnalysisContext({ tickerId: TICKER_ID }, db);

    expect(payload.ticker.sector).toBeNull();
    expect(payload.ticker.businessActivity).toBeNull();
  });
});
