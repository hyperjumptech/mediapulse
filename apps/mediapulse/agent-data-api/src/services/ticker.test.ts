/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {
    ticker: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@mediapulse/database";

import { getTickerForAgent } from "./ticker";

describe("getTickerForAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the ticker row is missing", async () => {
    // Setup
    vi.mocked(prisma.ticker.findUnique).mockResolvedValueOnce(null);

    // Act
    const result = await getTickerForAgent(
      "11111111-1111-4111-a111-111111111111",
    );

    // Assert
    expect(result).toBeNull();
  });

  it("returns identity, aliases, sector labels, business context, and peers", async () => {
    // Setup
    vi.mocked(prisma.ticker.findUnique).mockResolvedValueOnce({
      id: "11111111-1111-4111-a111-111111111111",
      symbol: "AGRO",
      name: "PT Bank Raya Indonesia Tbk",
      aliases: ["BRI Agro", "Bank Agroniaga", "BRI Agro"],
      sector: "Keuangan",
      industry: "Bank",
      subSector: "Bank",
      subIndustry: "Bank",
      businessActivity: "Perbankan",
    } as never);
    vi.mocked(prisma.ticker.findMany).mockResolvedValueOnce([
      {
        id: "22222222-2222-4222-a222-222222222222",
        symbol: "BBCA",
        name: "Bank Central Asia Tbk",
        metadataRaw: { marketCap: 100 },
      },
      {
        id: "33333333-3333-4333-a333-333333333333",
        symbol: "BBRI",
        name: "Bank Rakyat Indonesia Tbk",
        metadataRaw: { marketCap: 200 },
      },
    ] as never);

    // Act
    const result = await getTickerForAgent(
      "11111111-1111-4111-a111-111111111111",
    );

    // Assert
    expect(result).toEqual({
      id: "11111111-1111-4111-a111-111111111111",
      symbol: "AGRO",
      name: "PT Bank Raya Indonesia Tbk",
      aliases: ["BRI Agro", "Bank Agroniaga"],
      sector: "Keuangan",
      industry: "Bank",
      subSector: "Bank",
      subIndustry: "Bank",
      businessActivity: "Perbankan",
      peers: [
        { symbol: "BBRI", name: "Bank Rakyat Indonesia Tbk" },
        { symbol: "BBCA", name: "Bank Central Asia Tbk" },
      ],
    });
  });

  it("returns empty peers and null business context when columns lack them", async () => {
    // Setup
    vi.mocked(prisma.ticker.findUnique).mockResolvedValueOnce({
      id: "11111111-1111-4111-a111-111111111111",
      symbol: "XYZ",
      name: "Example Corp",
      aliases: [],
      sector: null,
      industry: null,
      subSector: null,
      subIndustry: null,
      businessActivity: null,
    } as never);

    // Act
    const result = await getTickerForAgent(
      "11111111-1111-4111-a111-111111111111",
    );

    // Assert
    expect(prisma.ticker.findMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: "11111111-1111-4111-a111-111111111111",
      symbol: "XYZ",
      name: "Example Corp",
      aliases: [],
      sector: null,
      industry: null,
      subSector: null,
      subIndustry: null,
      businessActivity: null,
      peers: [],
    });
  });
});
