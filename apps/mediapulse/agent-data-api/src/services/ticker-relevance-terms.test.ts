/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {
    ticker: {
      findMany: vi.fn(),
    },
    searchQuerySet: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@mediapulse/database";

import { getTickerRelevanceTermsForAgent } from "./ticker-relevance-terms";

const ANCHOR_TICKER_ID = "11111111-1111-4111-a111-111111111111";
const PEER_TICKER_ID = "22222222-2222-4222-a222-222222222222";
const INACTIVE_TICKER_ID = "33333333-3333-4333-a333-333333333333";

describe("getTickerRelevanceTermsForAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns no tickers when no search query set is active", async () => {
    // Setup
    vi.mocked(prisma.searchQuerySet.findMany).mockResolvedValueOnce(
      [] as never,
    );

    // Act
    const result = await getTickerRelevanceTermsForAgent();

    // Assert
    expect(result).toEqual({ tickers: [] });
    expect(prisma.ticker.findMany).not.toHaveBeenCalled();
  });

  it("only loads tickers that have an active search query set", async () => {
    // Setup
    vi.mocked(prisma.searchQuerySet.findMany).mockResolvedValueOnce([
      { tickerId: ANCHOR_TICKER_ID },
      { tickerId: ANCHOR_TICKER_ID },
    ] as never);
    vi.mocked(prisma.ticker.findMany).mockResolvedValueOnce([
      {
        id: ANCHOR_TICKER_ID,
        symbol: "AGRO",
        name: "PT Bank Raya Indonesia Tbk",
        aliases: [],
        sector: null,
        industry: null,
        subSector: null,
        subIndustry: null,
        profile: null,
      },
    ] as never);

    // Act
    const result = await getTickerRelevanceTermsForAgent();

    // Assert
    expect(prisma.ticker.findMany).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.ticker.findMany).mock.calls[0]?.[0]).toMatchObject({
      where: { id: { in: [ANCHOR_TICKER_ID] } },
    });
    expect(result.tickers.map((ticker) => ticker.id)).toEqual([
      ANCHOR_TICKER_ID,
    ]);
    expect(result.tickers).not.toContainEqual(
      expect.objectContaining({ id: INACTIVE_TICKER_ID }),
    );
  });

  it("collects symbol, name, aliases, peers, and sector labels without duplicates", async () => {
    // Setup
    vi.mocked(prisma.searchQuerySet.findMany).mockResolvedValueOnce([
      { tickerId: ANCHOR_TICKER_ID },
    ] as never);
    vi.mocked(prisma.ticker.findMany)
      .mockResolvedValueOnce([
        {
          id: ANCHOR_TICKER_ID,
          symbol: "AGRO",
          name: "PT Bank Raya Indonesia Tbk",
          aliases: ["BRI Agro", " bri agro ", "", "Bank Agroniaga"],
          sector: "Keuangan",
          industry: "Bank",
          subSector: "Bank",
          subIndustry: "Keuangan",
          profile: null,
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          id: ANCHOR_TICKER_ID,
          symbol: "AGRO",
          name: "PT Bank Raya Indonesia Tbk",
          sector: "Keuangan",
          industry: "Bank",
          metadataRaw: null,
        },
        {
          id: PEER_TICKER_ID,
          symbol: "BBCA",
          name: "Bank Central Asia Tbk",
          sector: "Keuangan",
          industry: "Bank",
          metadataRaw: { marketCap: 100 },
        },
      ] as never);

    // Act
    const result = await getTickerRelevanceTermsForAgent();

    // Assert
    expect(result.tickers).toHaveLength(1);
    expect(result.tickers[0]?.symbol).toBe("AGRO");
    expect(result.tickers[0]?.terms).toEqual([
      "AGRO",
      "PT Bank Raya Indonesia Tbk",
      "BRI Agro",
      "Bank Agroniaga",
      "BBCA",
      "Bank Central Asia Tbk",
      "Keuangan",
      "Bank",
    ]);
  });

  it("skips the peer query and sector terms when sector and industry are null", async () => {
    // Setup
    vi.mocked(prisma.searchQuerySet.findMany).mockResolvedValueOnce([
      { tickerId: ANCHOR_TICKER_ID },
    ] as never);
    vi.mocked(prisma.ticker.findMany).mockResolvedValueOnce([
      {
        id: ANCHOR_TICKER_ID,
        symbol: "XYZ",
        name: "Example Corp",
        aliases: [],
        sector: null,
        industry: null,
        subSector: null,
        subIndustry: null,
        profile: null,
      },
    ] as never);

    // Act
    const result = await getTickerRelevanceTermsForAgent();

    // Assert
    expect(prisma.ticker.findMany).toHaveBeenCalledTimes(1);
    expect(result.tickers[0]?.terms).toEqual(["XYZ", "Example Corp"]);
  });

  it("takes terms from the curated profile and skips the sector peer query", async () => {
    // Setup
    vi.mocked(prisma.searchQuerySet.findMany).mockResolvedValueOnce([
      { tickerId: ANCHOR_TICKER_ID },
    ] as never);
    vi.mocked(prisma.ticker.findMany).mockResolvedValueOnce([
      {
        id: ANCHOR_TICKER_ID,
        symbol: "AADI",
        name: "PT Adaro Andalan Indonesia Tbk",
        aliases: [],
        sector: "Energi",
        industry: "Batu Bara",
        subSector: "Batu Bara",
        subIndustry: "Pertambangan Batu Bara",
        profile: {
          sectorIndonesian: "Energi",
          subSectorIndonesian: "Batu Bara",
          industryIndonesian: "Batu Bara Termal",
          subIndustryIndonesian: "Batu Bara Kalori Menengah",
          aliases: ["Adaro Andalan", "Adaro"],
          competitors: [
            { name: "Indo Tambangraya Megah", aliases: ["ITMG", "ITM"] },
            { name: "Bukit Asam", aliases: ["PTBA"] },
          ],
        },
      },
    ] as never);

    // Act
    const result = await getTickerRelevanceTermsForAgent();

    // Assert
    expect(prisma.ticker.findMany).toHaveBeenCalledTimes(1);
    expect(result.tickers[0]?.terms).toEqual([
      "AADI",
      "PT Adaro Andalan Indonesia Tbk",
      "Adaro Andalan",
      "Adaro",
      "Indo Tambangraya Megah",
      "ITMG",
      "ITM",
      "Bukit Asam",
      "PTBA",
      "Energi",
      "Batu Bara",
      "Batu Bara Termal",
      "Batu Bara Kalori Menengah",
      "Pertambangan Batu Bara",
    ]);
  });

  it("keeps a curated peer alias that is not an exchange ticker symbol", async () => {
    // Setup
    vi.mocked(prisma.searchQuerySet.findMany).mockResolvedValueOnce([
      { tickerId: ANCHOR_TICKER_ID },
    ] as never);
    vi.mocked(prisma.ticker.findMany).mockResolvedValueOnce([
      {
        id: ANCHOR_TICKER_ID,
        symbol: "FORE",
        name: "PT Fore Kopi Indonesia Tbk",
        aliases: [],
        sector: "Barang Konsumen Primer",
        industry: "Minuman",
        subSector: "Makanan & Minuman",
        subIndustry: "Minuman Ringan",
        profile: {
          sectorIndonesian: "Barang Konsumen Primer",
          subSectorIndonesian: "Makanan & Minuman",
          industryIndonesian: "Jaringan Kedai Kopi",
          subIndustryIndonesian: "Kedai Kopi Berbasis Aplikasi",
          aliases: ["Fore Coffee"],
          competitors: [
            { name: "Mitra Adiperkasa", aliases: ["MAPI", "Starbucks"] },
            { name: "Kopi Tuku", aliases: ["Tuku", "PT"] },
          ],
        },
      },
    ] as never);

    // Act
    const result = await getTickerRelevanceTermsForAgent();
    const terms = result.tickers[0]?.terms ?? [];

    // Assert
    expect(terms).toContain("Starbucks");
    expect(terms).toContain("Tuku");
    expect(terms).not.toContain("PT");
  });

  it("keeps the exchange taxonomy so a curated profile only widens the term set", async () => {
    // Setup
    vi.mocked(prisma.searchQuerySet.findMany).mockResolvedValueOnce([
      { tickerId: ANCHOR_TICKER_ID },
    ] as never);
    vi.mocked(prisma.ticker.findMany).mockResolvedValueOnce([
      {
        id: ANCHOR_TICKER_ID,
        symbol: "FORE",
        name: "PT Fore Kopi Indonesia Tbk",
        aliases: [],
        sector: "Barang Konsumen Primer",
        industry: "Minuman",
        subSector: "Makanan & Minuman",
        subIndustry: "Minuman Ringan",
        profile: {
          sectorIndonesian: "Barang Konsumen Primer",
          subSectorIndonesian: "Makanan & Minuman",
          industryIndonesian: "Jaringan Kedai Kopi",
          subIndustryIndonesian: "Kedai Kopi Berbasis Aplikasi",
          aliases: [],
          competitors: [],
        },
      },
    ] as never);

    // Act
    const result = await getTickerRelevanceTermsForAgent();
    const terms = result.tickers[0]?.terms ?? [];

    // Assert
    expect(terms).toContain("Jaringan Kedai Kopi");
    expect(terms).toContain("Minuman");
    expect(terms).toContain("Minuman Ringan");
  });

  it("resolves peers for many active tickers with a single peer query", async () => {
    // Setup
    vi.mocked(prisma.searchQuerySet.findMany).mockResolvedValueOnce([
      { tickerId: ANCHOR_TICKER_ID },
      { tickerId: PEER_TICKER_ID },
    ] as never);
    vi.mocked(prisma.ticker.findMany)
      .mockResolvedValueOnce([
        {
          id: ANCHOR_TICKER_ID,
          symbol: "AGRO",
          name: "PT Bank Raya Indonesia Tbk",
          aliases: [],
          sector: "Keuangan",
          industry: "Bank",
          subSector: null,
          subIndustry: null,
          profile: null,
        },
        {
          id: PEER_TICKER_ID,
          symbol: "BBCA",
          name: "Bank Central Asia Tbk",
          aliases: [],
          sector: "Keuangan",
          industry: "Bank",
          subSector: null,
          subIndustry: null,
          profile: null,
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          id: ANCHOR_TICKER_ID,
          symbol: "AGRO",
          name: "PT Bank Raya Indonesia Tbk",
          sector: "Keuangan",
          industry: "Bank",
          metadataRaw: null,
        },
        {
          id: PEER_TICKER_ID,
          symbol: "BBCA",
          name: "Bank Central Asia Tbk",
          sector: "Keuangan",
          industry: "Bank",
          metadataRaw: null,
        },
      ] as never);

    // Act
    const result = await getTickerRelevanceTermsForAgent();

    // Assert
    expect(prisma.ticker.findMany).toHaveBeenCalledTimes(2);
    expect(result.tickers[0]?.terms).toContain("BBCA");
    expect(result.tickers[0]?.terms).not.toContain("AGRO Tbk");
    expect(result.tickers[1]?.terms).toContain("PT Bank Raya Indonesia Tbk");
  });
});
