/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  expandDataSources,
  expandSingleDataSource,
  type ExpandDataSourcesDb,
} from "./expand-data-sources";
import { parseDataSourceString } from "./data-source-string";

describe("expandSingleDataSource", () => {
  it("returns ticker id values from findMany", async () => {
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

    const values = await expandSingleDataSource(parsed!, db);

    expect(values).toEqual(["tid-1", "tid-2"]);
  });
});

describe("expandDataSources", () => {
  it("returns single param object when no data source strings", async () => {
    const db = {
      ticker: { findMany: async () => [] },
    } as unknown as ExpandDataSourcesDb;

    const result = await expandDataSources(
      { tickerId: "static-id", foo: "bar" },
      db,
    );

    expect(result).toEqual([{ tickerId: "static-id", foo: "bar" }]);
  });

  it("expands data source string to multiple param sets", async () => {
    const db = {
      ticker: {
        findMany: async () => [{ id: "tid-a" }, { id: "tid-b" }],
      },
    } as unknown as ExpandDataSourcesDb;

    const result = await expandDataSources(
      { tickerId: "db:ticker:all:id", extra: true },
      db,
    );

    expect(result).toEqual([
      { tickerId: "tid-a", extra: true },
      { tickerId: "tid-b", extra: true },
    ]);
  });

  it("returns [{}] when expansion yields empty and no other params", async () => {
    const db = {
      ticker: { findMany: async () => [] },
    } as unknown as ExpandDataSourcesDb;

    const result = await expandDataSources(
      { tickerId: "db:ticker:all:id" },
      db,
    );

    expect(result).toEqual([{}]);
  });

  it("leaves non-allowlisted data source string as-is", async () => {
    const db = {
      ticker: { findMany: async () => [] },
    } as unknown as ExpandDataSourcesDb;

    const result = await expandDataSources(
      { tickerId: "db:other_table:all:id" },
      db,
    );

    expect(result).toEqual([{ tickerId: "db:other_table:all:id" }]);
  });
});
