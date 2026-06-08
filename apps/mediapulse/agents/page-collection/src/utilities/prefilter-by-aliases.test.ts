import { describe, expect, it } from "vitest";

import type { DiscoveredItem } from "@workspace/agent-ingestion";

import { prefilterByAliases, type AliasContext } from "./prefilter-by-aliases";

const item = (
  url: string,
  title?: string,
  summary?: string,
): DiscoveredItem => ({ url, title, summary });

describe("prefilterByAliases", () => {
  it("keeps items whose title matches a ticker alias", () => {
    const items = [
      item("https://example.com/a", "Apple Earnings Report"),
      item("https://example.com/b", "Unrelated news story"),
    ];
    const aliasContext: AliasContext = {
      tickerAliases: ["apple"],
      industryAliases: [],
    };

    const result = prefilterByAliases(items, aliasContext);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe("https://example.com/a");
  });

  it("keeps items whose summary matches an industry alias", () => {
    const items = [
      item("https://example.com/a", "Market roundup", "Tech sector rally"),
      item("https://example.com/b", "Weather report", "Rain expected"),
    ];
    const aliasContext: AliasContext = {
      tickerAliases: [],
      industryAliases: ["tech"],
    };

    const result = prefilterByAliases(items, aliasContext);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe("https://example.com/a");
  });

  it("drops items with a title that mentions no alias", () => {
    const items = [
      item("https://example.com/a", "Sports roundup"),
      item("https://example.com/b", "Cooking tips"),
    ];
    const aliasContext: AliasContext = {
      tickerAliases: ["tsla"],
      industryAliases: [],
    };

    const result = prefilterByAliases(items, aliasContext);

    expect(result).toHaveLength(0);
  });

  it("passes through title-less items regardless of aliases", () => {
    const items = [
      item("https://example.com/a"),
      item("https://example.com/b"),
    ];
    const aliasContext: AliasContext = {
      tickerAliases: ["tsla"],
      industryAliases: [],
    };

    const result = prefilterByAliases(items, aliasContext);

    expect(result).toHaveLength(2);
  });

  it("returns all items when both alias lists are empty", () => {
    const items = [
      item("https://example.com/a", "Some title"),
      item("https://example.com/b"),
    ];
    const aliasContext: AliasContext = {
      tickerAliases: [],
      industryAliases: [],
    };

    const result = prefilterByAliases(items, aliasContext);

    expect(result).toHaveLength(2);
  });

  it("matches case-insensitively", () => {
    const items = [item("https://example.com/a", "TESLA Q3 Results")];
    const aliasContext: AliasContext = {
      tickerAliases: ["tesla"],
      industryAliases: [],
    };

    const result = prefilterByAliases(items, aliasContext);

    expect(result).toHaveLength(1);
  });

  it("mixes titled and title-less items correctly", () => {
    const items = [
      item("https://example.com/match", "Apple announces new products"),
      item("https://example.com/no-match", "Sports news today"),
      item("https://example.com/no-title"),
    ];
    const aliasContext: AliasContext = {
      tickerAliases: ["apple"],
      industryAliases: [],
    };

    const result = prefilterByAliases(items, aliasContext);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.url)).toEqual([
      "https://example.com/match",
      "https://example.com/no-title",
    ]);
  });
});
