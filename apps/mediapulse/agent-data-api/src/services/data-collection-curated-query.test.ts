/** @vitest-environment node */

import { describe, expect, it, vi } from "vitest";

import {
  CURATED_LISTING_TEXT,
  ensureCuratedListingQuery,
} from "./data-collection-curated-query";

const TICKER_A = "00000000-0000-0000-0000-000000000001";
const TICKER_B = "00000000-0000-0000-0000-000000000002";
const QUERY_ID_A = "aaaaaaaa-0000-0000-0000-000000000001";
const QUERY_ID_B = "bbbbbbbb-0000-0000-0000-000000000001";

describe("ensureCuratedListingQuery", () => {
  it("creates a curated query on first call and returns its id", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockResolvedValue({ id: QUERY_ID_A });
    const searchQuery = { findFirst, create };

    const result = await ensureCuratedListingQuery(TICKER_A, searchQuery);

    expect(result).toBe(QUERY_ID_A);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        tickerId: TICKER_A,
        source: "curated",
        text: CURATED_LISTING_TEXT,
      },
      select: { id: true },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        tickerId: TICKER_A,
        text: CURATED_LISTING_TEXT,
        source: "curated",
        setId: null,
      },
      select: { id: true },
    });
  });

  it("returns the existing id on second call without creating a new row", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: QUERY_ID_A });
    const create = vi.fn();
    const searchQuery = { findFirst, create };

    const result = await ensureCuratedListingQuery(TICKER_A, searchQuery);

    expect(result).toBe(QUERY_ID_A);
    expect(create).not.toHaveBeenCalled();
  });

  it("returns distinct ids for two different tickers", async () => {
    const findFirstA = vi.fn().mockResolvedValue({ id: QUERY_ID_A });
    const findFirstB = vi.fn().mockResolvedValue({ id: QUERY_ID_B });
    const create = vi.fn();

    const resultA = await ensureCuratedListingQuery(TICKER_A, {
      findFirst: findFirstA,
      create,
    });
    const resultB = await ensureCuratedListingQuery(TICKER_B, {
      findFirst: findFirstB,
      create,
    });

    expect(resultA).toBe(QUERY_ID_A);
    expect(resultB).toBe(QUERY_ID_B);
    expect(resultA).not.toBe(resultB);
    expect(create).not.toHaveBeenCalled();
  });
});
