/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { buildArticleRelevancePostChunks } from "./analysis-relevance-post-chunks.js";

const DS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DS_B = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";

describe("buildArticleRelevancePostChunks", () => {
  it("splits relevance rows into validated chunks", () => {
    const rows = [
      {
        dataSourceId: DS_A,
        score: 0.5,
        scoreBreakdown: {
          _version: 1,
          breakingNews: 0.5,
          kgRelation: 0.5,
          fundamental: 0.5,
          tickerSalience: 0.5,
          sourceQuality: 0.5,
        },
        selected: false,
      },
      {
        dataSourceId: DS_B,
        score: 0.6,
        scoreBreakdown: {
          _version: 1,
          breakingNews: 0.6,
          kgRelation: 0.6,
          fundamental: 0.6,
          tickerSalience: 0.6,
          sourceQuality: 0.6,
        },
        selected: true,
      },
    ];

    const { chunks, parseErrors } = buildArticleRelevancePostChunks(
      "ticker-1",
      rows,
      1,
    );

    expect(parseErrors).toHaveLength(0);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.articleRelevances).toHaveLength(1);
  });
});
