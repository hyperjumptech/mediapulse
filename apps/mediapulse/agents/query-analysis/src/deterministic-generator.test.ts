import { describe, expect, it } from "vitest";
import { generateDeterministicQueries } from "./deterministic-generator.js";
import type { TickerContext } from "./deterministic-generator.js";

const baseTicker = (): TickerContext => ({
  symbol: "AAPL",
  name: "Apple Inc.",
  topEntities: [
    { canonicalName: "Tim Cook",   typeName: "Person"  },
    { canonicalName: "App Store",  typeName: "Product" },
  ],
  recentThemes: [
    { theme: "iPhone" },
    { theme: "Vision Pro" },
  ],
});

describe("generateDeterministicQueries", () => {
  it("includes base templates for the ticker", () => {
    const queries = generateDeterministicQueries(baseTicker(), 0);
    const texts = queries.map((q) => q.text);

    expect(texts).toContain("AAPL latest news");
    expect(texts).toContain("Apple Inc. breaking news");
    expect(texts).toContain("Apple Inc. earnings guidance");
    expect(texts).toContain("Apple Inc. regulatory update");
  });

  it("generates kg_change queries from top entities", () => {
    const queries = generateDeterministicQueries(baseTicker(), 0);
    const texts = queries.map((q) => q.text);

    expect(texts).toContain("Tim Cook AAPL latest");
    expect(texts).toContain("App Store AAPL latest");
  });

  it("generates kg_change queries from recent themes", () => {
    const queries = generateDeterministicQueries(baseTicker(), 0);
    const texts = queries.map((q) => q.text);

    expect(texts).toContain("iPhone AAPL");
    expect(texts).toContain("Vision Pro AAPL");
  });

  it("deduplicates on normalised text", () => {
    const ticker = baseTicker();
    // Theme matches an entity slug
    ticker.recentThemes = [{ theme: "Tim Cook AAPL latest" }];
    const queries = generateDeterministicQueries(ticker, 0);
    const texts = queries.map((q) => q.text.toLowerCase().trim());
    const unique = new Set(texts);

    expect(unique.size).toBe(texts.length);
  });

  it("meets minCount by cycling templates when needed", () => {
    const ticker: TickerContext = { symbol: "XYZ", name: "X Corp", topEntities: [], recentThemes: [] };
    const queries = generateDeterministicQueries(ticker, 10);

    expect(queries.length).toBeGreaterThanOrEqual(10);
  });

  it("assigns correct intents to base templates", () => {
    const queries = generateDeterministicQueries(baseTicker(), 0);

    const breaking    = queries.filter((q) => q.intent === "breaking");
    const fundamental = queries.filter((q) => q.intent === "fundamental");
    const kgChange    = queries.filter((q) => q.intent === "kg_change");

    expect(breaking.length).toBeGreaterThanOrEqual(2);
    expect(fundamental.length).toBeGreaterThanOrEqual(4);
    expect(kgChange.length).toBeGreaterThanOrEqual(2);
  });
});
