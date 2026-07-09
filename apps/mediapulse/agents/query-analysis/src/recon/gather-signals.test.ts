/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import type { SearchHit } from "@workspace/agent-search";

import { gatherReconSignals } from "./gather-signals";

const baseInput = {
  ticker: {
    symbol: "FORE",
    name: "PT Fore Kopi Indonesia Tbk",
    aliases: ["Fore Coffee"],
  },
  classification: { sector: "Barang Konsumen Primer", industry: "Minuman" },
  homeMarket: "Indonesia",
  competitors: [
    { name: "Kopi Kenangan", aliases: [], searchKeywords: [] },
    { name: "Tomoro Coffee", aliases: [], searchKeywords: [] },
  ],
  providers: [{ provider: "serper" as const, apiKey: "k" }],
  locale: { gl: "id", hl: "id" },
  maxQueries: 12,
  maxCompetitors: 4,
  maxSignals: 15,
  resultsPerQuery: 5,
  concurrency: 4,
  timeoutMs: 10_000,
};

const createProvider = () =>
  ({ type: "serper" as const, search: vi.fn() }) as never;

const hit = (title: string): SearchHit => ({
  url: `https://example.test/${title}`,
  title,
  snippet: "s",
});

describe("gatherReconSignals", () => {
  it("runs field-only recon queries (industry + competitors, not the company) and dedupes titles", async () => {
    // Setup
    const search = vi.fn(async (query: string) => [
      hit(`Headline for ${query}`),
      hit("Shared headline"),
    ]);

    // Act
    const signals = await gatherReconSignals({
      ...baseInput,
      createProvider,
      search: search as never,
    });

    // Assert
    expect(search.mock.calls.some((call) => call[0].includes("Fore"))).toBe(
      false,
    );
    expect(search.mock.calls.some((call) => call[0].includes("Minuman"))).toBe(
      true,
    );
    expect(
      search.mock.calls.some((call) => call[0].includes("Kopi Kenangan")),
    ).toBe(true);
    expect(
      search.mock.calls.some((call) => call[0].includes("Tomoro Coffee")),
    ).toBe(true);
    expect(signals.filter((signal) => signal === "Shared headline")).toEqual([
      "Shared headline",
    ]);
  });

  it("caps signals to maxSignals", async () => {
    // Setup
    const search = vi.fn(async (query: string) =>
      Array.from({ length: 10 }, (_unused, index) => hit(`${query} ${index}`)),
    );

    // Act
    const signals = await gatherReconSignals({
      ...baseInput,
      maxSignals: 5,
      createProvider,
      search: search as never,
    });

    // Assert
    expect(signals).toHaveLength(5);
  });

  it("degrades to no signals when recon search throws", async () => {
    // Setup
    const warn = vi.fn();
    const search = vi.fn(async () => {
      throw new Error("boom");
    });

    // Act
    const signals = await gatherReconSignals({
      ...baseInput,
      createProvider,
      search: search as never,
      logger: { info: vi.fn(), warn },
    });

    // Assert
    expect(signals).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ tickerSymbol: "FORE" }),
      expect.stringContaining("recon failed"),
    );
  });
});
