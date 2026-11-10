import { describe, expect, it } from "vitest";

import type { ListedCompany } from "./listed-companies";
import {
  TICKER_WRITE_CONCURRENCY,
  syncTickersFromKnowledgeGraph,
  type TickerSyncDb,
} from "./sync-tickers";

type StoredTicker = { symbol: string; name: string };

type TickerCreateArgs = { data: StoredTicker };

type TickerUpdateArgs = {
  where: { symbol: string };
  data: { name: string };
};

const createFakeTickerDb = (initialTickers: StoredTicker[]) => {
  const tickers = initialTickers.map((ticker) => ({ ...ticker }));
  const created: StoredTicker[] = [];
  const updates: TickerUpdateArgs[] = [];
  const inFlight = { current: 0, peak: 0 };
  const trackWrite = async <Result>(write: () => Result): Promise<Result> => {
    inFlight.current += 1;
    inFlight.peak = Math.max(inFlight.peak, inFlight.current);
    await Promise.resolve();
    inFlight.current -= 1;

    return write();
  };
  const fake = {
    ticker: {
      findMany: async () => tickers.map((ticker) => ({ ...ticker })),
      create: (args: TickerCreateArgs) =>
        trackWrite(() => {
          created.push(args.data);
          tickers.push({ ...args.data });

          return args.data;
        }),
      update: (args: TickerUpdateArgs) =>
        trackWrite(() => {
          updates.push(args);
          const ticker = tickers.find(
            (stored) => stored.symbol === args.where.symbol,
          );
          if (ticker === undefined) {
            throw new Error(`No ticker ${args.where.symbol}`);
          }
          ticker.name = args.data.name;

          return ticker;
        }),
    },
  };

  return {
    db: fake as unknown as TickerSyncDb,
    tickers,
    created,
    updates,
    inFlight,
  };
};

describe("syncTickersFromKnowledgeGraph", () => {
  it("adds missing symbols, renames changed ones and keeps the rest", async () => {
    const fake = createFakeTickerDb([
      { symbol: "BBCA", name: "Bank Central Asia Tbk." },
      { symbol: "GOTO", name: "PT GoTo Gojek Tokopedia Tbk" },
    ]);
    const companies: ListedCompany[] = [
      { symbol: "BBCA", name: "PT Bank Central Asia Tbk" },
      { symbol: "GOTO", name: "PT GoTo Gojek Tokopedia Tbk" },
      { symbol: "MAPB", name: "PT Map Boga Adiperkasa Tbk" },
    ];

    const result = await syncTickersFromKnowledgeGraph(companies, fake.db);

    expect(result).toEqual({
      added: 1,
      updated: 1,
      unchanged: 1,
      missingFromKnowledgeGraph: [],
    });
    expect(fake.created).toEqual([
      { symbol: "MAPB", name: "PT Map Boga Adiperkasa Tbk" },
    ]);
    expect(fake.updates).toEqual([
      {
        where: { symbol: "BBCA" },
        data: { name: "PT Bank Central Asia Tbk" },
      },
    ]);
  });

  it("never deletes and lists table symbols the knowledge graph does not, sorted", async () => {
    const fake = createFakeTickerDb([
      { symbol: "ZZZZ", name: "Delisted Tbk" },
      { symbol: "BBCA", name: "PT Bank Central Asia Tbk" },
      { symbol: "AAAA", name: "Test Ticker" },
    ]);

    const result = await syncTickersFromKnowledgeGraph(
      [{ symbol: "BBCA", name: "PT Bank Central Asia Tbk" }],
      fake.db,
    );

    expect(result).toEqual({
      added: 0,
      updated: 0,
      unchanged: 1,
      missingFromKnowledgeGraph: ["AAAA", "ZZZZ"],
    });
    expect(fake.tickers.map((ticker) => ticker.symbol)).toEqual([
      "ZZZZ",
      "BBCA",
      "AAAA",
    ]);
  });

  it("matches a symbol stored in another case instead of adding a duplicate", async () => {
    const fake = createFakeTickerDb([{ symbol: "bbca", name: "Old Name" }]);

    const result = await syncTickersFromKnowledgeGraph(
      [{ symbol: "BBCA", name: "PT Bank Central Asia Tbk" }],
      fake.db,
    );

    expect(result).toEqual({
      added: 0,
      updated: 1,
      unchanged: 0,
      missingFromKnowledgeGraph: [],
    });
    expect(fake.created).toEqual([]);
    expect(fake.updates).toEqual([
      {
        where: { symbol: "bbca" },
        data: { name: "PT Bank Central Asia Tbk" },
      },
    ]);
  });

  it("writes each symbol once when the list repeats it", async () => {
    const fake = createFakeTickerDb([]);

    const result = await syncTickersFromKnowledgeGraph(
      [
        { symbol: "MAPB", name: "PT Map Boga Adiperkasa Tbk" },
        { symbol: "mapb", name: "Map Boga" },
      ],
      fake.db,
    );

    expect(result.added).toBe(1);
    expect(fake.created).toEqual([
      { symbol: "MAPB", name: "PT Map Boga Adiperkasa Tbk" },
    ]);
  });

  it("limits how many writes run at once", async () => {
    const fake = createFakeTickerDb([]);
    const companyCount = TICKER_WRITE_CONCURRENCY * 2 + 3;
    const companies = Array.from({ length: companyCount }, (_, index) => ({
      symbol: `T${String(index).padStart(3, "0")}`,
      name: `Company ${index}`,
    }));

    const result = await syncTickersFromKnowledgeGraph(companies, fake.db);

    expect(result.added).toBe(companyCount);
    expect(fake.created).toHaveLength(companyCount);
    expect(fake.inFlight.peak).toBeLessThanOrEqual(TICKER_WRITE_CONCURRENCY);
    expect(fake.inFlight.peak).toBeGreaterThan(1);
  });
});
