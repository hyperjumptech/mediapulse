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

import {
  getTickerRelevanceTermsForAgent,
  taxonomyPhraseSegments,
} from "./ticker-relevance-terms";

const ANCHOR_TICKER_ID = "11111111-1111-4111-a111-111111111111";
const PEER_TICKER_ID = "22222222-2222-4222-a222-222222222222";
const INACTIVE_TICKER_ID = "33333333-3333-4333-a333-333333333333";

describe("taxonomyPhraseSegments", () => {
  it("recovers the business lines a descriptive label buries", () => {
    const segments = taxonomyPhraseSegments(
      "Batu Bara dengan Diversifikasi Emas dan EV",
    );

    expect(segments).toContain("Batu Bara");
    expect(segments).toContain("Emas");
    expect(segments).toContain("EV");
  });

  it("recovers the product word a coffee issuer is actually reported on", () => {
    const segments = taxonomyPhraseSegments(
      "Kedai Kopi Berbasis Aplikasi dan Pengantaran",
    );

    expect(segments).toContain("Kedai Kopi");
    expect(segments).toContain("Kopi");
  });

  it("keeps a plain single-term label as itself and adds nothing", () => {
    expect(taxonomyPhraseSegments("Bank")).toEqual(["Bank"]);
    expect(taxonomyPhraseSegments("Minuman Ringan")).toEqual([
      "Minuman Ringan",
      "Minuman",
      "Ringan",
    ]);
  });

  it("splits on punctuation as well as connectors", () => {
    const segments = taxonomyPhraseSegments(
      "Holding Bank, Asuransi dan Multifinance Grup",
    );

    expect(segments).toContain("Asuransi");
    expect(segments).toContain("Bank");
  });

  it("drops connectors and segments that name no business", () => {
    const segments = taxonomyPhraseSegments(
      "Pusat Data Tier IV untuk Penyedia Cloud Hyperscale",
    );

    expect(segments).toContain("Cloud");
    expect(segments).not.toContain("dan");
    expect(segments).not.toContain("untuk");
    expect(segments).not.toContain("Tier");
    expect(segments).not.toContain("IV");
  });

  it("does not emit a bare word from a single-word segment", () => {
    expect(taxonomyPhraseSegments("Kelistrikan")).toEqual(["Kelistrikan"]);
  });

  it("does not index a generic business verb or a compound fragment", () => {
    const coal = taxonomyPhraseSegments("Produksi Batu Bara");

    expect(coal).toContain("Produksi Batu Bara");
    expect(coal).not.toContain("Produksi");
    expect(coal).not.toContain("Batu");
    expect(coal).not.toContain("Bara");

    const industrial = taxonomyPhraseSegments(
      "Penjualan Lahan Industri dengan Jasa Pengelolaan Kawasan",
    );

    expect(industrial).toContain("Industri");
    expect(industrial).toContain("Kawasan");
    expect(industrial).not.toContain("Penjualan");
    expect(industrial).not.toContain("Jasa");
    expect(industrial).not.toContain("Pengelolaan");
  });

  it("returns nothing for a label made only of connectors", () => {
    expect(taxonomyPhraseSegments("dan untuk dengan")).toEqual([]);
  });
});

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
      "Termal",
      "Batu Bara Kalori Menengah",
      "Kalori",
      "Menengah",
      "Pertambangan Batu Bara",
      "Pertambangan",
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
