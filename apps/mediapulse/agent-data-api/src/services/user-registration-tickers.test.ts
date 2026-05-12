/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { listTickersForUserRegistration } from "./user-registration-tickers.js";

describe("listTickersForUserRegistration", () => {
  it("returns mapped tickers ordered by delegate results", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { symbol: "BBCA", name: "Bank Central Asia Tbk" },
      { symbol: "TLKM", name: "Telkom Indonesia Tbk" },
    ]);

    const result = await listTickersForUserRegistration({
      findMany,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { symbol: true, name: true },
        orderBy: { symbol: "asc" },
      }),
    );
    expect(result.tickers).toEqual([
      { symbol: "BBCA", name: "Bank Central Asia Tbk" },
      { symbol: "TLKM", name: "Telkom Indonesia Tbk" },
    ]);
  });

  it("returns an empty list when the database has no tickers", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    const result = await listTickersForUserRegistration({ findMany });

    expect(result.tickers).toEqual([]);
  });
});
