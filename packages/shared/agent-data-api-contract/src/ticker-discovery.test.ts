/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  postTickerDiscoveryLookupBodySchema,
  postTickerDiscoveryLookupResponseSchema,
  postTickerDiscoveryRecordBodySchema,
  postTickerDiscoveryRecordResponseSchema,
} from "./ticker-discovery.js";

const TICKER_ID = "11111111-1111-4111-a111-111111111111";

describe("postTickerDiscoveryLookupBodySchema", () => {
  it("requires a uuid tickerId", () => {
    // Act
    const parsed = postTickerDiscoveryLookupBodySchema.parse({
      tickerId: TICKER_ID,
    });

    // Assert
    expect(parsed.tickerId).toBe(TICKER_ID);
  });
});

describe("postTickerDiscoveryLookupResponseSchema", () => {
  it("accepts a null entry on a miss", () => {
    // Act
    const parsed = postTickerDiscoveryLookupResponseSchema.parse({
      entry: null,
    });

    // Assert
    expect(parsed.entry).toBeNull();
  });

  it("accepts a populated entry with competitors and regulators", () => {
    // Act
    const parsed = postTickerDiscoveryLookupResponseSchema.parse({
      entry: {
        tickerId: TICKER_ID,
        competitors: [
          { name: "Rival Co", aliases: ["Rival"], searchKeywords: ["rival"] },
        ],
        regulators: [{ name: "OJK", aliases: [], searchKeywords: ["ojk"] }],
        model: "gpt-test",
        expiresAt: "2026-01-02T00:00:00.000Z",
      },
    });

    // Assert
    expect(parsed.entry?.competitors[0]?.name).toBe("Rival Co");
    expect(parsed.entry?.regulators[0]?.name).toBe("OJK");
  });
});

describe("postTickerDiscoveryRecordBodySchema", () => {
  it("makes model optional and requires a positive ttlSeconds", () => {
    // Act
    const parsed = postTickerDiscoveryRecordBodySchema.parse({
      tickerId: TICKER_ID,
      competitors: [],
      regulators: [],
      ttlSeconds: 3600,
    });

    // Assert
    expect(parsed.model).toBeUndefined();
    expect(parsed.ttlSeconds).toBe(3600);
  });

  it("rejects a non-positive ttlSeconds", () => {
    // Act
    const result = postTickerDiscoveryRecordBodySchema.safeParse({
      tickerId: TICKER_ID,
      competitors: [],
      regulators: [],
      ttlSeconds: 0,
    });

    // Assert
    expect(result.success).toBe(false);
  });
});

describe("postTickerDiscoveryRecordResponseSchema", () => {
  it("accepts a tickerId and expiry", () => {
    // Act
    const parsed = postTickerDiscoveryRecordResponseSchema.parse({
      tickerId: TICKER_ID,
      expiresAt: "2026-01-02T00:00:00.000Z",
    });

    // Assert
    expect(parsed.tickerId).toBe(TICKER_ID);
  });
});
