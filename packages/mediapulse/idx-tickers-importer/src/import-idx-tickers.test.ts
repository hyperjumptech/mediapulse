/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  importIdxTickers,
  mapIdxRowToTicker,
  type TickerUpsertDb,
} from "./import-idx-tickers";
import type { IdxTickersPayload } from "./types";

vi.mock("@mediapulse/database", () => ({
  prisma: {},
}));

const createMockDb = (): TickerUpsertDb => ({
  ticker: {
    findUnique: vi.fn(),
    create: vi
      .fn()
      .mockResolvedValue({ id: "id-1", symbol: "AADI", name: "PT Adaro" }),
    update: vi
      .fn()
      .mockResolvedValue({ id: "id-1", symbol: "AADI", name: "PT Adaro" }),
  },
});

describe("mapIdxRowToTicker", () => {
  it("maps KodeEmiten/NamaEmiten and promotes classification columns", () => {
    // Setup
    const row = {
      KodeEmiten: "AADI",
      NamaEmiten: "PT Adaro Andalan Indonesia Tbk",
      Sektor: "Energi",
      Industri: "Batu Bara",
      SubSektor: "Pertambangan",
      SubIndustri: "Batu Bara",
      KegiatanUsahaUtama: "Pertambangan batu bara",
    };

    // Act
    const result = mapIdxRowToTicker(row);

    // Assert
    expect(result.symbol).toBe("AADI");
    expect(result.name).toBe("PT Adaro Andalan Indonesia Tbk");
    expect(result.sector).toBe("Energi");
    expect(result.industry).toBe("Batu Bara");
    expect(result.subSector).toBe("Pertambangan");
    expect(result.subIndustry).toBe("Batu Bara");
    expect(result.businessActivity).toBe("Pertambangan batu bara");
    expect(result.aliases).toEqual([]);
    expect(result.metadataRaw).toEqual(row);
  });

  it("trims symbol and name", () => {
    // Setup
    const row = { KodeEmiten: "  BBHI  ", NamaEmiten: "  Bank  " };

    // Act
    const result = mapIdxRowToTicker(row);

    // Assert
    expect(result.symbol).toBe("BBHI");
    expect(result.name).toBe("Bank");
  });

  it("uses empty string for missing name, null classification, and full row in metadataRaw", () => {
    // Setup
    const row = {
      KodeEmiten: "X",
      NamaEmiten: undefined,
    } as unknown as IdxTickersPayload["data"][number];

    // Act
    const result = mapIdxRowToTicker(row);

    // Assert
    expect(result.symbol).toBe("X");
    expect(result.name).toBe("");
    expect(result.sector).toBeNull();
    expect(result.industry).toBeNull();
    expect(result.metadataRaw).toEqual(row);
  });
});

const nullClassification = {
  sector: null,
  industry: null,
  subSector: null,
  subIndustry: null,
  businessActivity: null,
  aliases: [],
};

describe("importIdxTickers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates new tickers and returns added count when none exist", async () => {
    // Setup
    const db = createMockDb();
    vi.mocked(db.ticker.findUnique).mockResolvedValue(null);
    const payload: IdxTickersPayload = {
      draw: 0,
      recordsTotal: 2,
      recordsFiltered: 2,
      data: [
        { KodeEmiten: "AADI", NamaEmiten: "PT Adaro Andalan Indonesia Tbk" },
        { KodeEmiten: "BBHI", NamaEmiten: "PT Bank Harda Internasional Tbk" },
      ],
    };

    // Act
    const result = await importIdxTickers(payload, db);

    // Assert
    expect(result).toEqual({ added: 2, updated: 0 });
    expect(db.ticker.findUnique).toHaveBeenCalledTimes(2);
    expect(db.ticker.create).toHaveBeenCalledTimes(2);
    expect(db.ticker.create).toHaveBeenNthCalledWith(1, {
      data: {
        symbol: "AADI",
        name: "PT Adaro Andalan Indonesia Tbk",
        ...nullClassification,
        metadataRaw: payload.data[0],
      },
    });
    expect(db.ticker.create).toHaveBeenNthCalledWith(2, {
      data: {
        symbol: "BBHI",
        name: "PT Bank Harda Internasional Tbk",
        ...nullClassification,
        metadataRaw: payload.data[1],
      },
    });
    expect(db.ticker.update).not.toHaveBeenCalled();
  });

  it("updates existing tickers and returns updated count when all exist", async () => {
    // Setup
    const db = createMockDb();
    vi.mocked(db.ticker.findUnique).mockResolvedValue({ id: "existing-id" });
    const payload: IdxTickersPayload = {
      data: [
        { KodeEmiten: "AADI", NamaEmiten: "PT Adaro Andalan Indonesia Tbk" },
        { KodeEmiten: "BBHI", NamaEmiten: "PT Bank Harda Internasional Tbk" },
      ],
    };

    // Act
    const result = await importIdxTickers(payload, db);

    // Assert
    expect(result).toEqual({ added: 0, updated: 2 });
    expect(db.ticker.findUnique).toHaveBeenCalledTimes(2);
    expect(db.ticker.update).toHaveBeenCalledTimes(2);
    expect(db.ticker.update).toHaveBeenNthCalledWith(1, {
      where: { symbol: "AADI" },
      data: {
        name: "PT Adaro Andalan Indonesia Tbk",
        ...nullClassification,
        metadataRaw: payload.data[0],
      },
    });
    expect(db.ticker.create).not.toHaveBeenCalled();
  });

  it("returns mixed added and updated when some symbols exist", async () => {
    // Setup
    const db = createMockDb();
    vi.mocked(db.ticker.findUnique)
      .mockResolvedValueOnce({ id: "id-aadi" })
      .mockResolvedValueOnce(null);
    const payload: IdxTickersPayload = {
      data: [
        { KodeEmiten: "AADI", NamaEmiten: "PT Adaro" },
        { KodeEmiten: "BBHI", NamaEmiten: "PT Bank" },
      ],
    };

    // Act
    const result = await importIdxTickers(payload, db);

    // Assert
    expect(result).toEqual({ added: 1, updated: 1 });
    expect(db.ticker.update).toHaveBeenCalledTimes(1);
    expect(db.ticker.update).toHaveBeenCalledWith({
      where: { symbol: "AADI" },
      data: {
        name: "PT Adaro",
        ...nullClassification,
        metadataRaw: payload.data[0],
      },
    });
    expect(db.ticker.create).toHaveBeenCalledTimes(1);
    expect(db.ticker.create).toHaveBeenCalledWith({
      data: {
        symbol: "BBHI",
        name: "PT Bank",
        ...nullClassification,
        metadataRaw: payload.data[1],
      },
    });
  });

  it("skips rows with empty KodeEmiten", async () => {
    // Setup
    const db = createMockDb();
    vi.mocked(db.ticker.findUnique).mockResolvedValue(null);
    const payload: IdxTickersPayload = {
      data: [
        { KodeEmiten: "", NamaEmiten: "No Code" },
        { KodeEmiten: "  ", NamaEmiten: "Whitespace" },
        { KodeEmiten: "OK", NamaEmiten: "Valid" },
      ],
    };

    // Act
    const result = await importIdxTickers(payload, db);

    // Assert
    expect(result).toEqual({ added: 1, updated: 0 });
    expect(db.ticker.findUnique).toHaveBeenCalledTimes(1);
    expect(db.ticker.create).toHaveBeenCalledTimes(1);
    expect(db.ticker.create).toHaveBeenCalledWith({
      data: {
        symbol: "OK",
        name: "Valid",
        ...nullClassification,
        metadataRaw: payload.data[2],
      },
    });
  });

  it("uses symbol as name when NamaEmiten is empty", async () => {
    // Setup
    const db = createMockDb();
    vi.mocked(db.ticker.findUnique).mockResolvedValue(null);
    const payload: IdxTickersPayload = {
      data: [{ KodeEmiten: "XYZ", NamaEmiten: "" }],
    };

    // Act
    await importIdxTickers(payload, db);

    // Assert
    expect(db.ticker.create).toHaveBeenCalledWith({
      data: {
        symbol: "XYZ",
        name: "XYZ",
        ...nullClassification,
        metadataRaw: payload.data[0],
      },
    });
  });

  it("handles empty data array", async () => {
    // Setup
    const db = createMockDb();
    const payload: IdxTickersPayload = { data: [] };

    // Act
    const result = await importIdxTickers(payload, db);

    // Assert
    expect(result).toEqual({ added: 0, updated: 0 });
    expect(db.ticker.findUnique).not.toHaveBeenCalled();
    expect(db.ticker.create).not.toHaveBeenCalled();
    expect(db.ticker.update).not.toHaveBeenCalled();
  });

  it("handles missing or invalid payload.data", async () => {
    // Setup
    const db = createMockDb();

    // Act
    const result = await importIdxTickers({} as IdxTickersPayload, db);

    // Assert
    expect(result).toEqual({ added: 0, updated: 0 });
    expect(db.ticker.findUnique).not.toHaveBeenCalled();
  });
});
