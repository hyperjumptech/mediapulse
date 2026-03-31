/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type DataCollectionLocalDb,
  DATA_COLLECTION_LOCAL_TICKER_ID,
  DATA_COLLECTION_LOCAL_TICKER_MSFT_ID,
  DATA_COLLECTION_LOCAL_TICKERS,
  seedDataCollectionLocal,
} from "./seed-data-collection-local";

type MockDb = {
  ticker: {
    upsert: ReturnType<typeof vi.fn>;
  };
  searchQuery: {
    upsert: ReturnType<typeof vi.fn>;
  };
};

const createMockDb = (): MockDb => ({
  ticker: {
    upsert: vi.fn().mockResolvedValue(undefined),
  },
  searchQuery: {
    upsert: vi.fn().mockResolvedValue(undefined),
  },
});

const asDb = (db: MockDb): DataCollectionLocalDb =>
  db as unknown as DataCollectionLocalDb;

describe("seedDataCollectionLocal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("upserts two tickers and all search queries", async () => {
    const db = createMockDb();

    const result = await seedDataCollectionLocal(asDb(db));

    expect(result.tickers).toHaveLength(DATA_COLLECTION_LOCAL_TICKERS.length);
    expect(result.tickers[0]?.tickerId).toBe(DATA_COLLECTION_LOCAL_TICKER_ID);
    expect(result.tickers[1]?.tickerId).toBe(
      DATA_COLLECTION_LOCAL_TICKER_MSFT_ID,
    );
    expect(db.ticker.upsert).toHaveBeenCalledTimes(2);
    expect(db.searchQuery.upsert).toHaveBeenCalledTimes(4);
  });

  it("ties AAPL search queries to the Apple ticker id and copy", async () => {
    const db = createMockDb();

    await seedDataCollectionLocal(asDb(db));

    expect(db.searchQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "22222222-2222-4222-a222-222222222222" },
        create: expect.objectContaining({
          tickerId: DATA_COLLECTION_LOCAL_TICKER_ID,
          text: "Apple AAPL quarterly earnings revenue iPhone Services",
        }),
        update: expect.objectContaining({
          tickerId: DATA_COLLECTION_LOCAL_TICKER_ID,
        }),
      }),
    );
  });

  it("ties MSFT search queries to the Microsoft ticker id", async () => {
    const db = createMockDb();

    await seedDataCollectionLocal(asDb(db));

    expect(db.searchQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "55555555-5555-4555-a555-555555555555" },
        create: expect.objectContaining({
          tickerId: DATA_COLLECTION_LOCAL_TICKER_MSFT_ID,
          text: "Microsoft MSFT Azure cloud revenue Satya Nadella",
        }),
      }),
    );
  });
});
