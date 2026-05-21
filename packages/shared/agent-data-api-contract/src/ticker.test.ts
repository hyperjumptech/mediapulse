/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { getTickerQuerySchema, getTickerResponseSchema } from "./ticker.js";

describe("getTickerQuerySchema", () => {
  it("requires a non-empty tickerId", () => {
    // Act
    const parsed = getTickerQuerySchema.parse({
      tickerId: "11111111-1111-4111-a111-111111111111",
    });

    // Assert
    expect(parsed.tickerId).toBe("11111111-1111-4111-a111-111111111111");
  });
});

describe("getTickerResponseSchema", () => {
  it("accepts a ticker payload with aliases", () => {
    // Act
    const parsed = getTickerResponseSchema.parse({
      id: "11111111-1111-4111-a111-111111111111",
      symbol: "BBCA",
      name: "Bank Central Asia Tbk",
      aliases: ["BCA", "Bank Central Asia"],
    });

    // Assert
    expect(parsed.aliases).toEqual(["BCA", "Bank Central Asia"]);
  });
});
