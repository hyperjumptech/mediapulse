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
  it("returns the ticker with its classification columns and a null profile", async () => {
    const findUniqueOrThrow = vi.fn().mockResolvedValue({
      id: TICKER_ID,
      symbol: "ACME",
      name: "Acme Co",
      sector: "Technology",
      industry: "Software",
      subSector: "Application Software",
      subIndustry: "SaaS",
      businessActivity: "Enterprise software",
      profile: null,
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
      profile: null,
    });
    expect(findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TICKER_ID } }),
    );
  });

  it("shapes the curated profile into both language sides", async () => {
    const db = {
      ticker: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: TICKER_ID,
          symbol: "AADI",
          name: "Adaro Andalan Indonesia",
          aliases: [],
          sector: "Energi",
          industry: "Batu Bara",
          subSector: null,
          subIndustry: null,
          businessActivity: null,
          profile: {
            companyOverview: "Thermal coal producer.",
            businessOperation: "Mines and sells thermal coal.",
            sectorIndonesian: "Energi",
            sectorEnglish: "Energy",
            subSectorIndonesian: "Batu Bara",
            subSectorEnglish: "Coal",
            industryIndonesian: "Batu Bara Termal",
            industryEnglish: "Thermal Coal",
            subIndustryIndonesian: "Penambangan Batu Bara Termal",
            subIndustryEnglish: "Thermal Coal Mining",
            aliases: ["AADI", "Adaro Andalan"],
            competitors: [
              { name: "Indo Tambangraya Megah", aliases: ["ITMG"] },
              { name: 42, aliases: ["bad"] },
            ],
            regulators: [{ name: "Kementerian ESDM" }],
          },
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

    expect(payload.profile?.sector).toEqual({
      indonesian: "Energi",
      english: "Energy",
    });
    expect(payload.profile?.subIndustry.english).toBe("Thermal Coal Mining");
    expect(payload.profile?.competitors).toEqual([
      { name: "Indo Tambangraya Megah", aliases: ["ITMG"] },
    ]);
    expect(payload.profile?.regulators).toEqual([
      { name: "Kementerian ESDM", aliases: [] },
    ]);
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
