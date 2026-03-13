/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  expandDataSources,
  expandSingleDataSource,
  DEFAULT_TAKE,
  MAX_TAKE,
  type ExpandDataSourcesDb,
} from "./expand-data-sources";
import { parseDataSourceString } from "./data-source-string";

describe("expandSingleDataSource", () => {
  it("returns ticker id values from findMany", async () => {
    // Setup
    const db: ExpandDataSourcesDb = {
      ticker: {
        findMany: async ({ select, where }) => {
          expect(select).toEqual({ id: true });
          if (where && Object.keys(where).length > 0) return [{ id: "tid-1" }];
          return [{ id: "tid-1" }, { id: "tid-2" }];
        },
      },
    };
    const parsed = parseDataSourceString("db:ticker:all:id");
    expect(parsed).not.toBeNull();

    // Act
    const values = await expandSingleDataSource(parsed!, db);

    // Assert
    expect(values).toEqual(["tid-1", "tid-2"]);
  });

  it("returns null when model not found", async () => {
    // Setup
    const db: ExpandDataSourcesDb = {
      ticker: { findMany: async () => [] },
    };
    const parsed = parseDataSourceString("db:nonExistentModel:all:id");
    expect(parsed).not.toBeNull();

    // Act
    const values = await expandSingleDataSource(parsed!, db);

    // Assert
    expect(values).toBeNull();
  });

  it("applies take cap", async () => {
    // Setup
    const db: ExpandDataSourcesDb = {
      ticker: {
        findMany: async ({ take }) => {
          expect(take).toBe(10);
          return Array.from({ length: 10 }, (_, i) => ({ id: `id-${i}` }));
        },
      },
    };
    const parsed = parseDataSourceString("db:ticker:all:id?take=10");
    expect(parsed).not.toBeNull();

    // Act
    const values = await expandSingleDataSource(parsed!, db);

    // Assert
    expect(values).toHaveLength(10);
  });

  it("returns distinct values when distinct specified", async () => {
    // Setup
    const db: ExpandDataSourcesDb = {
      userTicker: {
        findMany: async ({ select, where }) => {
          expect(select).toEqual({ tickerId: true });
          expect(where).toEqual({ enabled: true });
          return [{ tickerId: "t1" }, { tickerId: "t1" }, { tickerId: "t2" }];
        },
      },
    };
    const parsed = parseDataSourceString(
      "db:userTicker:all:tickerId?where.enabled=true&distinct=tickerId",
    );
    expect(parsed).not.toBeNull();

    // Act
    const values = await expandSingleDataSource(parsed!, db);

    // Assert
    expect(values).toEqual(["t1", "t2"]);
  });
});

describe("expandDataSources", () => {
  it("returns single param object when no data source strings", async () => {
    // Setup
    const db = {
      ticker: { findMany: async () => [] },
    } as unknown as ExpandDataSourcesDb;

    // Act
    const result = await expandDataSources(
      { tickerId: "static-id", foo: "bar" },
      db,
    );

    // Assert
    expect(result).toEqual([{ tickerId: "static-id", foo: "bar" }]);
  });

  it("expands data source string to multiple param sets", async () => {
    // Setup
    const db = {
      ticker: {
        findMany: async () => [{ id: "tid-a" }, { id: "tid-b" }],
      },
    } as unknown as ExpandDataSourcesDb;

    // Act
    const result = await expandDataSources(
      { tickerId: "db:ticker:all:id", extra: true },
      db,
    );

    // Assert
    expect(result).toEqual([
      { tickerId: "tid-a", extra: true },
      { tickerId: "tid-b", extra: true },
    ]);
  });

  it("returns [{}] when expansion yields empty and no other params", async () => {
    // Setup
    const db = {
      ticker: { findMany: async () => [] },
    } as unknown as ExpandDataSourcesDb;

    // Act
    const result = await expandDataSources(
      { tickerId: "db:ticker:all:id" },
      db,
    );

    // Assert
    expect(result).toEqual([{}]);
  });

  it("expands data source string for unknown table (passes through)", async () => {
    // Setup
    const db = {
      ticker: { findMany: async () => [] },
    } as unknown as ExpandDataSourcesDb;

    // Act
    const result = await expandDataSources(
      { tickerId: "db:otherTable:all:id" },
      db,
    );

    // Assert
    expect(result).toEqual([{ tickerId: "db:otherTable:all:id" }]);
  });

  it("leaves non-parseable data source string as-is", async () => {
    // Setup
    const db = {
      ticker: { findMany: async () => [] },
    } as unknown as ExpandDataSourcesDb;

    // Act
    const result = await expandDataSources({ tickerId: "invalid:format" }, db);

    // Assert
    expect(result).toEqual([{ tickerId: "invalid:format" }]);
  });

  it("applies default take when omitted", async () => {
    // Setup
    let capturedTake: number | undefined;
    const db = {
      ticker: {
        findMany: async (args: { take?: number }) => {
          capturedTake = args.take;
          return [{ id: "id-1" }];
        },
      },
    } as unknown as ExpandDataSourcesDb;

    // Act
    await expandDataSources({ tickerId: "db:ticker:all:id" }, db);

    // Assert
    expect(capturedTake).toBe(DEFAULT_TAKE);
  });

  it("caps take at MAX_TAKE when options provided", async () => {
    // Setup
    let capturedTake: number | undefined;
    const db = {
      ticker: {
        findMany: async (args: { take?: number }) => {
          capturedTake = args.take;
          return [{ id: "id-1" }];
        },
      },
    } as unknown as ExpandDataSourcesDb;

    // Act
    await expandDataSources({ tickerId: "db:ticker:all:id?take=99999" }, db, {
      defaultTake: 500,
      maxTake: MAX_TAKE,
    });

    // Assert
    expect(capturedTake).toBe(MAX_TAKE);
  });
});
