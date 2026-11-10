import { describe, expect, it } from "vitest";

import type { ListedCompany } from "./listed-companies";
import {
  MAX_TICKER_REMOVALS_PER_SYNC,
  TickerRemovalLimitError,
  syncTickersFromKnowledgeGraph,
  type TickerSyncDb,
} from "./sync-tickers";

type StoredTicker = { symbol: string; name: string; referenced?: boolean };

type SymbolFilter = { where?: { symbol?: { in: string[] } } };

type TickerCreateManyArgs = {
  data: { symbol: string; name: string }[];
  skipDuplicates: boolean;
};

const createFakeTickerDb = (initialTickers: StoredTicker[]) => {
  let tickers = initialTickers.map((ticker) => ({ ...ticker }));
  const createManyCalls: TickerCreateManyArgs[] = [];
  const deletedSymbols: string[] = [];
  const unreferencedIn = (filter: SymbolFilter) => {
    const symbols = filter.where?.symbol?.in ?? [];

    return tickers.filter(
      (ticker) => symbols.includes(ticker.symbol) && ticker.referenced !== true,
    );
  };
  const fake = {
    ticker: {
      findMany: async (args: SymbolFilter) => {
        const rows = args.where === undefined ? tickers : unreferencedIn(args);

        return rows.map((ticker) => ({ symbol: ticker.symbol }));
      },
      createMany: async (args: TickerCreateManyArgs) => {
        createManyCalls.push(args);
        tickers.push(...args.data.map((ticker) => ({ ...ticker })));

        return { count: args.data.length };
      },
      deleteMany: async (args: SymbolFilter) => {
        const doomed = new Set(
          unreferencedIn(args).map((ticker) => ticker.symbol),
        );
        deletedSymbols.push(...doomed);
        tickers = tickers.filter((ticker) => !doomed.has(ticker.symbol));

        return { count: doomed.size };
      },
    },
  };

  return {
    db: fake as unknown as TickerSyncDb,
    tickers: () => tickers,
    createManyCalls,
    deletedSymbols,
  };
};

describe("syncTickersFromKnowledgeGraph", () => {
  it("adds missing symbols and leaves every existing ticker name as it is", async () => {
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
      alreadyPresent: 2,
      removed: [],
      keptUnlisted: [],
    });
    expect(fake.createManyCalls).toEqual([
      {
        data: [{ symbol: "MAPB", name: "PT Map Boga Adiperkasa Tbk" }],
        skipDuplicates: true,
      },
    ]);
    expect(fake.tickers()).toEqual([
      { symbol: "BBCA", name: "Bank Central Asia Tbk." },
      { symbol: "GOTO", name: "PT GoTo Gojek Tokopedia Tbk" },
      { symbol: "MAPB", name: "PT Map Boga Adiperkasa Tbk" },
    ]);
  });

  it("removes unlisted tickers nothing references and keeps the referenced ones", async () => {
    const fake = createFakeTickerDb([
      { symbol: "TOYS", name: "PT Sunindo Adipersada Tbk." },
      { symbol: "BBCA", name: "PT Bank Central Asia Tbk" },
      { symbol: "SBAT", name: "PT Sejahtera Bintang Abadi Textile Tbk." },
      { symbol: "OLDX", name: "Old Issuer Tbk", referenced: true },
    ]);

    const result = await syncTickersFromKnowledgeGraph(
      [{ symbol: "BBCA", name: "PT Bank Central Asia Tbk" }],
      fake.db,
    );

    expect(result).toEqual({
      added: 0,
      alreadyPresent: 1,
      removed: ["SBAT", "TOYS"],
      keptUnlisted: ["OLDX"],
    });
    expect(fake.tickers().map((ticker) => ticker.symbol)).toEqual([
      "BBCA",
      "OLDX",
    ]);
  });

  it("refuses to remove more tickers than one sync allows and changes nothing", async () => {
    const unlisted = Array.from(
      { length: MAX_TICKER_REMOVALS_PER_SYNC + 1 },
      (_, index) => ({
        symbol: `X${String(index).padStart(3, "0")}`,
        name: `Issuer ${index}`,
      }),
    );
    const fake = createFakeTickerDb([
      ...unlisted,
      { symbol: "BBCA", name: "PT Bank Central Asia Tbk" },
    ]);

    await expect(
      syncTickersFromKnowledgeGraph(
        [
          { symbol: "BBCA", name: "PT Bank Central Asia Tbk" },
          { symbol: "MAPB", name: "PT Map Boga Adiperkasa Tbk" },
        ],
        fake.db,
      ),
    ).rejects.toBeInstanceOf(TickerRemovalLimitError);
    expect(fake.createManyCalls).toEqual([]);
    expect(fake.deletedSymbols).toEqual([]);
  });

  it("matches a symbol stored in another case instead of adding or removing it", async () => {
    const fake = createFakeTickerDb([{ symbol: "bbca", name: "Old Name" }]);

    const result = await syncTickersFromKnowledgeGraph(
      [{ symbol: "BBCA", name: "PT Bank Central Asia Tbk" }],
      fake.db,
    );

    expect(result).toEqual({
      added: 0,
      alreadyPresent: 1,
      removed: [],
      keptUnlisted: [],
    });
    expect(fake.tickers()).toEqual([{ symbol: "bbca", name: "Old Name" }]);
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
    expect(fake.createManyCalls).toEqual([
      {
        data: [{ symbol: "MAPB", name: "PT Map Boga Adiperkasa Tbk" }],
        skipDuplicates: true,
      },
    ]);
  });

  it("writes nothing when the table already matches", async () => {
    const fake = createFakeTickerDb([
      { symbol: "BBCA", name: "PT Bank Central Asia Tbk" },
    ]);

    await syncTickersFromKnowledgeGraph(
      [{ symbol: "BBCA", name: "PT Bank Central Asia Tbk" }],
      fake.db,
    );

    expect(fake.createManyCalls).toEqual([]);
    expect(fake.deletedSymbols).toEqual([]);
  });
});
