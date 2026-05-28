/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import type { SourceFingerprint } from "@workspace/agent-data-api-contract";

import {
  candidateFingerprintText,
  dedupeAgainstCorpus,
  type SemanticDedupeCandidate,
} from "./semantic-dedupe";

const earningsExisting: SourceFingerprint = {
  id: "11111111-1111-4111-a111-111111111111",
  title: "Apple Q2 earnings beat",
  headSnippet: "Apple reported record Q2 earnings across all segments.",
};

const earningsCandidate = (
  title: string,
  url: string,
): SemanticDedupeCandidate => ({
  url,
  title,
  content: `${title}. Additional analyst commentary follows.`,
  tickerId: "ticker-1",
  searchQueryId: "22222222-2222-4222-a222-222222222222",
  searchQueryText: "Apple earnings",
  serpIndex: 0,
  provider: "jina",
});

/** Deterministic embedder for syndicated earnings headline pairs. */
const fakeEmbedder = (texts: string[]): Promise<number[][]> =>
  Promise.resolve(
    texts.map((text) => {
      if (text.includes("Vision Pro")) {
        return [0, 1, 0];
      }
      if (text.includes("estimates")) {
        return [0.89, 0.45, 0];
      }
      return [1, 0, 0];
    }),
  );

describe("dedupeAgainstCorpus", () => {
  it("drops a near-duplicate candidate at threshold 0.88", async () => {
    const result = await dedupeAgainstCorpus(
      [
        earningsCandidate(
          "Apple beats Q2 earnings estimates",
          "http://example.com/earnings",
        ),
      ],
      [earningsExisting],
      { threshold: 0.88, embedder: fakeEmbedder },
    );

    expect(result.kept).toHaveLength(0);
    expect(result.dropped).toHaveLength(1);
    expect(result.dropped[0]).toMatchObject({
      matchedExistingId: earningsExisting.id,
    });
    expect(result.dropped[0]?.similarity).toBeGreaterThan(0.88);
  });

  it("keeps a near-duplicate candidate at threshold 0.95", async () => {
    const result = await dedupeAgainstCorpus(
      [
        earningsCandidate(
          "Apple beats Q2 earnings estimates",
          "http://example.com/earnings",
        ),
      ],
      [earningsExisting],
      { threshold: 0.95, embedder: fakeEmbedder },
    );

    expect(result.kept).toHaveLength(1);
    expect(result.dropped).toHaveLength(0);
  });

  it("keeps candidates when the corpus is empty", async () => {
    const candidate = earningsCandidate(
      "Apple beats Q2 earnings estimates",
      "http://example.com/earnings",
    );

    const result = await dedupeAgainstCorpus([candidate], [], {
      threshold: 0.88,
      embedder: fakeEmbedder,
    });

    expect(result).toEqual({ kept: [candidate], dropped: [] });
  });
});

describe("candidateFingerprintText", () => {
  it("combines title and content head", () => {
    expect(candidateFingerprintText("Title", "body")).toBe("Title\nbody");
  });
});
