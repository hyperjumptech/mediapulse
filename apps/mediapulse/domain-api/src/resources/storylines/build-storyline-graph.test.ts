/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  buildStorylineGraph,
  STORYLINE_GRAPH_CITATIONS_PER_DEVELOPMENT,
  STORYLINE_GRAPH_DEVELOPMENT_CAP,
  STORYLINE_GRAPH_RANK_DEVELOPMENT,
  STORYLINE_GRAPH_RANK_SOURCE,
  STORYLINE_GRAPH_RANK_STORYLINE,
  STORYLINE_GRAPH_RANK_TICKER,
  STORYLINE_GRAPH_TOTAL_SOURCE_CAP,
  type BuildStorylineGraphInput,
} from "./build-storyline-graph";

const storyline = {
  id: "s1",
  name: "Contract delay",
  kind: "story",
  firstObservedAt: new Date("2026-03-02T00:00:00.000Z"),
  lastObservedAt: new Date("2026-04-18T00:00:00.000Z"),
};

const buildInput = (
  overrides: Partial<BuildStorylineGraphInput> = {},
): BuildStorylineGraphInput => ({
  storyline,
  tickers: [
    { tickerId: "t1", symbol: "FORE", name: "Foresta", source: "placement" },
  ],
  developments: [
    {
      id: "d1",
      title: "Delay confirmed",
      observedAt: new Date("2026-03-02T00:00:00.000Z"),
      attachEvidence: null,
      citationCount: 1,
    },
  ],
  citations: [
    {
      developmentId: "d1",
      dataSourceId: "ds1",
      title: "Delay confirmed by regulator",
      url: "https://example.test/a",
      publisher: "example.test",
    },
  ],
  ...overrides,
});

const idsAtRank = (
  graph: ReturnType<typeof buildStorylineGraph>,
  rank: number,
): string[] =>
  graph.nodes.filter((node) => node.rank === rank).map((node) => node.id);

describe("buildStorylineGraph", () => {
  it("emits one node per layer with the storyline emphasized", () => {
    const graph = buildStorylineGraph(buildInput());

    expect(idsAtRank(graph, STORYLINE_GRAPH_RANK_TICKER)).toEqual([
      "ticker:t1",
    ]);
    expect(idsAtRank(graph, STORYLINE_GRAPH_RANK_STORYLINE)).toEqual([
      "storyline:s1",
    ]);
    expect(idsAtRank(graph, STORYLINE_GRAPH_RANK_DEVELOPMENT)).toEqual([
      "development:d1",
    ]);
    expect(idsAtRank(graph, STORYLINE_GRAPH_RANK_SOURCE)).toEqual([
      "source:ds1",
    ]);
    expect(
      graph.nodes.find((node) => node.id === "storyline:s1")?.emphasis,
    ).toBe(true);
  });

  it("wires ticker to storyline to development to source", () => {
    const graph = buildStorylineGraph(buildInput());

    expect(graph.edges).toEqual([
      { source: "ticker:t1", target: "storyline:s1", label: null },
      { source: "storyline:s1", target: "development:d1", label: null },
      { source: "development:d1", target: "source:ds1", label: null },
    ]);
  });

  it("labels an operator ticker link and leaves placement unlabelled", () => {
    const graph = buildStorylineGraph(
      buildInput({
        tickers: [
          {
            tickerId: "t1",
            symbol: "FORE",
            name: "Foresta",
            source: "operator",
          },
        ],
      }),
    );

    expect(graph.edges[0]?.label).toBe("operator");
  });

  it("links tickers and sources but never the storyline or a development", () => {
    const graph = buildStorylineGraph(buildInput());
    const linkById = new Map(
      graph.nodes.map((node) => [node.id, node.linkResource]),
    );

    expect(linkById.get("ticker:t1")).toBe("tickers");
    expect(linkById.get("source:ds1")).toBe("data-sources");
    expect(linkById.get("storyline:s1")).toBeNull();
    expect(linkById.get("development:d1")).toBeNull();
  });

  it("summarizes the storyline in its tooltip", () => {
    const graph = buildStorylineGraph(buildInput());

    expect(
      graph.nodes.find((node) => node.id === "storyline:s1")?.tooltip,
    ).toBe("Story · 1 developments · 1 citations · 2026-03-02 – 2026-04-18");
  });

  it("puts the observed day and attach evidence in a development tooltip", () => {
    const graph = buildStorylineGraph(
      buildInput({
        developments: [
          {
            id: "d1",
            title: "Delay confirmed",
            observedAt: new Date("2026-04-18T00:00:00.000Z"),
            attachEvidence: {
              sharedAnchors: 6,
              containment: 0.71,
              storylineContainment: 0.62,
              path: "body",
            },
            citationCount: 0,
          },
        ],
        citations: [],
      }),
    );

    expect(
      graph.nodes.find((node) => node.id === "development:d1")?.tooltip,
    ).toBe(
      "2026-04-18 · Body path · 6 shared anchors · containment 0.71 · thread 0.62",
    );
  });

  it("orders tickers by symbol and developments chronologically", () => {
    const graph = buildStorylineGraph(
      buildInput({
        tickers: [
          { tickerId: "t2", symbol: "ZINC", name: "Zinc", source: "placement" },
          { tickerId: "t1", symbol: "ACME", name: "Acme", source: "placement" },
        ],
        developments: [
          {
            id: "late",
            title: "Later",
            observedAt: new Date("2026-04-18T00:00:00.000Z"),
            attachEvidence: null,
            citationCount: 0,
          },
          {
            id: "early",
            title: "Earlier",
            observedAt: new Date("2026-03-02T00:00:00.000Z"),
            attachEvidence: null,
            citationCount: 0,
          },
        ],
        citations: [],
      }),
    );

    expect(idsAtRank(graph, STORYLINE_GRAPH_RANK_TICKER)).toEqual([
      "ticker:t1",
      "ticker:t2",
    ]);
    expect(idsAtRank(graph, STORYLINE_GRAPH_RANK_DEVELOPMENT)).toEqual([
      "development:early",
      "development:late",
    ]);
  });

  it("reports nothing truncated for a small storyline", () => {
    const graph = buildStorylineGraph(buildInput());

    expect(graph.truncated).toBe(false);
    expect(graph.truncatedLabel).toBe("");
  });

  it("keeps the most recent developments and marks the earlier ones", () => {
    const developments = Array.from(
      { length: STORYLINE_GRAPH_DEVELOPMENT_CAP + 3 },
      (_unused, index) => ({
        id: `d${String(index)}`,
        title: `Development ${String(index)}`,
        observedAt: new Date(Date.UTC(2026, 0, index + 1)),
        attachEvidence: null,
        citationCount: 0,
      }),
    );
    const graph = buildStorylineGraph(
      buildInput({ developments, citations: [] }),
    );
    const drawn = idsAtRank(graph, STORYLINE_GRAPH_RANK_DEVELOPMENT);

    expect(drawn).toHaveLength(STORYLINE_GRAPH_DEVELOPMENT_CAP + 1);
    expect(drawn).toContain("development:overflow");
    expect(drawn).not.toContain("development:d0");
    expect(drawn).toContain(
      `development:d${String(STORYLINE_GRAPH_DEVELOPMENT_CAP + 2)}`,
    );
    expect(graph.truncated).toBe(true);
    expect(graph.truncatedLabel).toContain("3 earlier developments");
  });

  it("caps the sources drawn beneath one development", () => {
    const citations = Array.from({ length: 7 }, (_unused, index) => ({
      developmentId: "d1",
      dataSourceId: `ds${String(index)}`,
      title: `Source ${String(index)}`,
      url: `https://example.test/${String(index)}`,
      publisher: "example.test",
    }));
    const graph = buildStorylineGraph(buildInput({ citations }));
    const sources = idsAtRank(graph, STORYLINE_GRAPH_RANK_SOURCE);

    expect(sources).toHaveLength(STORYLINE_GRAPH_CITATIONS_PER_DEVELOPMENT + 1);
    expect(sources).toContain("source:overflow:d1");
    expect(graph.truncatedLabel).toContain("3 further sources");
  });

  it("stops drawing sources once the total budget is spent", () => {
    const developments = Array.from({ length: 30 }, (_unused, index) => ({
      id: `d${String(index)}`,
      title: `Development ${String(index)}`,
      observedAt: new Date(Date.UTC(2026, 0, index + 1)),
      attachEvidence: null,
      citationCount: 4,
    }));
    const citations = developments.flatMap((development) =>
      Array.from({ length: 4 }, (_unused, index) => ({
        developmentId: development.id,
        dataSourceId: `${development.id}-ds${String(index)}`,
        title: `Source ${String(index)}`,
        url: `https://example.test/${development.id}/${String(index)}`,
        publisher: "example.test",
      })),
    );
    const graph = buildStorylineGraph(buildInput({ developments, citations }));
    const realSources = graph.nodes.filter((node) => node.group === "source");

    expect(realSources).toHaveLength(STORYLINE_GRAPH_TOTAL_SOURCE_CAP);
    expect(graph.truncatedLabel).toContain("further sources");
  });

  it("falls back to the url when a data source has no title", () => {
    const graph = buildStorylineGraph(
      buildInput({
        citations: [
          {
            developmentId: "d1",
            dataSourceId: "ds1",
            title: null,
            url: "https://example.test/a",
            publisher: null,
          },
        ],
      }),
    );

    expect(graph.nodes.find((node) => node.id === "source:ds1")?.label).toBe(
      "https://example.test/a",
    );
  });

  it("draws a storyline that has no tickers and no developments", () => {
    const graph = buildStorylineGraph(
      buildInput({ tickers: [], developments: [], citations: [] }),
    );

    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toEqual([]);
  });

  it("never emits a duplicate node id", () => {
    const graph = buildStorylineGraph(buildInput());
    const ids = graph.nodes.map((node) => node.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
