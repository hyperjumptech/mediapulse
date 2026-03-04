/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  importIdxTickers,
  mapIdxRowToTicker,
  type TickerUpsertDb,
} from "./import-idx-tickers";
import type { IdxTickersPayload } from "./types";

vi.mock("@workspace/database", () => ({
  prisma: {},
}));

const createMockDb = (): TickerUpsertDb => ({
  ticker: {
    upsert: vi
      .fn()
      .mockResolvedValue({ id: "id-1", symbol: "AADI", name: "PT Adaro" }),
  },
});

describe("mapIdxRowToTicker", () => {
  it("maps KodeEmiten to symbol and NamaEmiten to name", () => {
    // Setup
    const row = {
      KodeEmiten: "AADI",
      NamaEmiten: "PT Adaro Andalan Indonesia Tbk",
      Sektor: "Energi",
    };

    // Act
    const result = mapIdxRowToTicker(row);

    // Assert
    expect(result.symbol).toBe("AADI");
    expect(result.name).toBe("PT Adaro Andalan Indonesia Tbk");
    expect(result.metadata).toEqual(row);
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

  it("uses empty string for missing name and includes full row in metadata", () => {
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
    expect(result.metadata).toEqual(row);
  });
});

describe("importIdxTickers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls upsert for each row with symbol and name from payload", async () => {
    // Setup
    const db = createMockDb();
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
    expect(result.processed).toBe(2);
    expect(db.ticker.upsert).toHaveBeenCalledTimes(2);
    expect(db.ticker.upsert).toHaveBeenNthCalledWith(1, {
      where: { symbol: "AADI" },
      create: {
        symbol: "AADI",
        name: "PT Adaro Andalan Indonesia Tbk",
        metadata: payload.data[0],
      },
      update: {
        name: "PT Adaro Andalan Indonesia Tbk",
        metadata: payload.data[0],
      },
    });
    expect(db.ticker.upsert).toHaveBeenNthCalledWith(2, {
      where: { symbol: "BBHI" },
      create: {
        symbol: "BBHI",
        name: "PT Bank Harda Internasional Tbk",
        metadata: payload.data[1],
      },
      update: {
        name: "PT Bank Harda Internasional Tbk",
        metadata: payload.data[1],
      },
    });
  });

  it("skips rows with empty KodeEmiten", async () => {
    // Setup
    const db = createMockDb();
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
    expect(result.processed).toBe(3);
    expect(db.ticker.upsert).toHaveBeenCalledTimes(1);
    expect(db.ticker.upsert).toHaveBeenCalledWith({
      where: { symbol: "OK" },
      create: { symbol: "OK", name: "Valid", metadata: payload.data[2] },
      update: { name: "Valid", metadata: payload.data[2] },
    });
  });

  it("uses symbol as name when NamaEmiten is empty", async () => {
    // Setup
    const db = createMockDb();
    const payload: IdxTickersPayload = {
      data: [{ KodeEmiten: "XYZ", NamaEmiten: "" }],
    };

    // Act
    await importIdxTickers(payload, db);

    // Assert
    expect(db.ticker.upsert).toHaveBeenCalledWith({
      where: { symbol: "XYZ" },
      create: { symbol: "XYZ", name: "XYZ", metadata: payload.data[0] },
      update: { name: "XYZ", metadata: payload.data[0] },
    });
  });

  it("handles empty data array", async () => {
    // Setup
    const db = createMockDb();
    const payload: IdxTickersPayload = { data: [] };

    // Act
    const result = await importIdxTickers(payload, db);

    // Assert
    expect(result.processed).toBe(0);
    expect(db.ticker.upsert).not.toHaveBeenCalled();
  });

  it("handles missing or invalid payload.data", async () => {
    // Setup
    const db = createMockDb();

    // Act
    const result = await importIdxTickers({} as IdxTickersPayload, db);

    // Assert
    expect(result.processed).toBe(0);
    expect(db.ticker.upsert).not.toHaveBeenCalled();
  });
});
