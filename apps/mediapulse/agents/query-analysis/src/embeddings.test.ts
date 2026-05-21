/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildEmbeddingByText,
  buildQuerySemanticEmbedder,
  collectQueryTextsForEmbedding,
  cosineSimilarity,
  dedupeBySimilarity,
  embedQueries,
  maxCosineSimilarity,
} from "./embeddings";
import {
  dedupeLlmBySimilarity,
  mergeQueryCandidates,
} from "./merge-query-candidates";

const vecA = [1, 0, 0];
/** Unit vector with ~0.92 cosine similarity to `vecA` (survives 0.95, drops at 0.85). */
const vecNearA = [0.92, 0.39, 0];
const vecDistinct = [0, 1, 0];

const fakeEmbeddingMap = new Map<string, number[]>([
  ["AAPL latest news", vecA],
  ["Apple latest news", vecNearA],
  ["AAPL supply chain risk", vecDistinct],
  ["ACME earnings guidance", vecA],
  ["Apple Inc earnings call", vecNearA],
]);

const fakeEmbedder = (threshold: number) => ({
  threshold,
  embeddingByText: fakeEmbeddingMap,
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical unit vectors", () => {
    expect(cosineSimilarity(vecA, vecA)).toBeCloseTo(1);
  });

  it("returns high similarity for near-duplicate unit vectors", () => {
    const sim = cosineSimilarity(vecA, vecNearA);
    expect(sim).toBeGreaterThan(0.85);
    expect(sim).toBeLessThan(0.95);
  });
});

describe("dedupeBySimilarity", () => {
  const rows = [
    { text: "AAPL latest news" },
    { text: "Apple latest news" },
    { text: "AAPL supply chain risk" },
  ];
  const embeddings = [vecA, vecNearA, vecDistinct];

  it("collapses near-duplicates at threshold 0.85", () => {
    const deduped = dedupeBySimilarity(rows, embeddings, 0.85, 1);
    expect(deduped.map((row) => row.text)).toEqual([
      "AAPL latest news",
      "AAPL supply chain risk",
    ]);
  });

  it("keeps near-duplicates at threshold 0.95", () => {
    const deduped = dedupeBySimilarity(rows, embeddings, 0.95, 1);
    expect(deduped.map((row) => row.text)).toEqual([
      "AAPL latest news",
      "Apple latest news",
      "AAPL supply chain risk",
    ]);
  });
});

describe("dedupeLlmBySimilarity", () => {
  it("drops a semantically similar LLM row when a deterministic anchor exists", () => {
    const llm = dedupeLlmBySimilarity(
      [
        { text: "Apple Inc earnings call", intent: "fundamental" },
        { text: "AAPL supply chain risk", intent: "supply_chain" },
      ],
      [{ text: "ACME earnings guidance", intent: "fundamental" }],
      fakeEmbedder(0.85),
    );

    expect(llm).toEqual([
      {
        text: "AAPL supply chain risk",
        intent: "supply_chain",
        source: "llm",
      },
    ]);
  });
});

describe("mergeQueryCandidates with semantic embedder", () => {
  it("prefers deterministic anchors over semantically similar LLM rows", () => {
    const merged = mergeQueryCandidates({
      deterministic: [
        { text: "ACME earnings guidance", intent: "fundamental" },
      ],
      llm: [
        { text: "Apple Inc earnings call", intent: "fundamental" },
        { text: "AAPL supply chain risk", intent: "supply_chain" },
      ],
      queryCount: 3,
      minDeterministicCount: 1,
      weights: {
        breaking: 1,
        kg_change: 0.8,
        fundamental: 0.6,
        sentiment: 0.5,
        competitor: 0.5,
        supply_chain: 0.4,
        esg: 0.3,
        macro: 0.4,
        technical: 0.3,
      },
      embedder: fakeEmbedder(0.85),
    });

    expect(merged.map((row) => row.text)).toEqual([
      "ACME earnings guidance",
      "AAPL supply chain risk",
    ]);
    expect(merged.every((row) => row.text !== "Apple Inc earnings call")).toBe(
      true,
    );
  });
});

describe("collectQueryTextsForEmbedding", () => {
  it("dedupes texts and preserves deterministic-first order", () => {
    const texts = collectQueryTextsForEmbedding(
      [{ text: "  AAPL news  " }, { text: "AAPL news" }],
      [{ text: "Apple news" }],
    );
    expect(texts).toEqual(["AAPL news", "Apple news"]);
  });
});

describe("embedQueries", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an empty array without calling the API when texts is empty", async () => {
    const embedManyFn = vi.fn();
    const vectors = await embedQueries(
      [],
      { apiKey: "sk-test" },
      { embedManyFn },
    );
    expect(vectors).toEqual([]);
    expect(embedManyFn).not.toHaveBeenCalled();
  });

  it("batches all texts in a single embedMany call", async () => {
    const embedManyFn = vi.fn().mockResolvedValue({
      embeddings: [vecA, vecDistinct],
    });
    const vectors = await embedQueries(
      ["AAPL news", "supply chain"],
      { apiKey: "sk-test", model: "text-embedding-3-small" },
      { embedManyFn },
    );
    expect(embedManyFn).toHaveBeenCalledTimes(1);
    expect(vectors).toHaveLength(2);
  });
});

describe("buildQuerySemanticEmbedder", () => {
  it("maps trimmed texts to embedding vectors", () => {
    const embedder = buildQuerySemanticEmbedder(
      ["AAPL news", "supply chain"],
      [vecA, vecDistinct],
      0.85,
    );
    expect(embedder.embeddingByText.get("AAPL news")).toEqual(vecA);
    expect(maxCosineSimilarity(vecNearA, [vecA])).toBeGreaterThan(0.85);
    expect(buildEmbeddingByText(["x"], [vecA]).get("x")).toEqual(vecA);
  });
});
