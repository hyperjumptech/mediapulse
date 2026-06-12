import { describe, expect, it, vi } from "vitest";

import { buildSelectedSources } from "./build-selected-sources";

describe("buildSelectedSources", () => {
  it("queries the per-day window matching the newsletter createdAt", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    const result = await buildSelectedSources(
      "nl-1",
      "tk-1",
      new Date("2026-05-14T13:42:11.123Z"),
      { dataSource: { findMany } },
    );

    expect(result.windowStart).toBe("2026-05-14T00:00:00.000Z");
    expect(result.windowEnd).toBe("2026-05-15T00:00:00.000Z");

    const args = findMany.mock.calls[0]?.[0];
    expect(args?.where?.tickerId).toBe("tk-1");
    expect(args?.where?.articleRelevances?.some).toMatchObject({
      tickerId: "tk-1",
      selected: true,
      scoredAt: {
        gte: new Date("2026-05-14T00:00:00.000Z"),
        lt: new Date("2026-05-15T00:00:00.000Z"),
      },
    });
  });

  it("sorts results by score desc with scoredAt as tiebreaker", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "src-low",
        url: "https://example.com/low",
        title: "Low",
        searchQueryId: "sq",
        createdAt: new Date("2026-05-14T01:00:00.000Z"),
        searchQuery: { source: "deterministic" },
        articleRelevances: [
          { score: 0.2, scoredAt: new Date("2026-05-14T01:00:00.000Z") },
        ],
      },
      {
        id: "src-mid-1",
        url: "https://example.com/mid1",
        title: "Mid 1",
        searchQueryId: "sq",
        createdAt: new Date("2026-05-14T01:00:00.000Z"),
        searchQuery: { source: "deterministic" },
        articleRelevances: [
          { score: 0.7, scoredAt: new Date("2026-05-14T03:00:00.000Z") },
        ],
      },
      {
        id: "src-mid-2",
        url: "https://example.com/mid2",
        title: "Mid 2",
        searchQueryId: "sq",
        createdAt: new Date("2026-05-14T01:00:00.000Z"),
        searchQuery: { source: "deterministic" },
        articleRelevances: [
          { score: 0.7, scoredAt: new Date("2026-05-14T05:00:00.000Z") },
        ],
      },
    ]);

    const result = await buildSelectedSources(
      "nl-1",
      "tk-1",
      new Date("2026-05-14T13:00:00.000Z"),
      { dataSource: { findMany } },
    );

    expect(result.sources.map((s) => s.id)).toStrictEqual([
      "src-mid-2",
      "src-mid-1",
      "src-low",
    ]);
  });

  it("falls back to row.createdAt and score=0 when no relevance row is included", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "src-x",
        url: "https://example.com/x",
        title: "X",
        searchQueryId: "sq",
        createdAt: new Date("2026-05-14T02:00:00.000Z"),
        searchQuery: { source: "llm" },
        articleRelevances: [],
      },
    ]);

    const result = await buildSelectedSources(
      "nl-1",
      "tk-1",
      new Date("2026-05-14T13:00:00.000Z"),
      { dataSource: { findMany } },
    );

    expect(result.sources[0]).toMatchObject({
      id: "src-x",
      score: 0,
      scoredAt: "2026-05-14T02:00:00.000Z",
    });
  });

  it("emits collectionSource and label for curated and deterministic rows", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "src-curated",
        url: "https://example.com/curated",
        title: "Curated",
        searchQueryId: "sq-c",
        createdAt: new Date("2026-05-14T01:00:00.000Z"),
        searchQuery: { source: "curated" },
        articleRelevances: [
          { score: 0.9, scoredAt: new Date("2026-05-14T01:00:00.000Z") },
        ],
      },
      {
        id: "src-det",
        url: "https://example.com/det",
        title: "Deterministic",
        searchQueryId: "sq-d",
        createdAt: new Date("2026-05-14T01:00:00.000Z"),
        searchQuery: { source: "deterministic" },
        articleRelevances: [
          { score: 0.5, scoredAt: new Date("2026-05-14T01:00:00.000Z") },
        ],
      },
    ]);

    const result = await buildSelectedSources(
      "nl-1",
      "tk-1",
      new Date("2026-05-14T13:00:00.000Z"),
      { dataSource: { findMany } },
    );

    const curated = result.sources.find((s) => s.id === "src-curated");
    const deterministic = result.sources.find((s) => s.id === "src-det");

    expect(curated?.collectionSource).toBe("page-collection");
    expect(curated?.collectionSourceLabel).toBe("Page Collection");
    expect(deterministic?.collectionSource).toBe("data-collection");
    expect(deterministic?.collectionSourceLabel).toBe("Data Collection");
  });
});
